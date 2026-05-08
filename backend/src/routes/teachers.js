import express from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

let teacherProfilePhotoColumnReady;

async function ensureTeacherProfilePhotoColumn() {
  if (!teacherProfilePhotoColumnReady) {
    teacherProfilePhotoColumnReady = query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS profile_photo_url TEXT');
  }

  return teacherProfilePhotoColumnReady;
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ') || firstName;
  return { firstName, lastName };
}

function fullName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ');
}

function mapTeacher(row) {
  return {
    ...row,
    id: row.id,
    user_id: row.user_id,
    name: fullName(row) || row.name,
    role: 'teacher',
    is_active: row.is_active,
    classes: row.classes || [],
  };
}

async function getTeacherCompensation(teacherId, client) {
  const salaries = await query(
    `
      SELECT *
      FROM teacher_salaries
      WHERE teacher_id = $1
      ORDER BY is_active DESC, effective_date DESC
    `,
    [teacherId],
    client,
  );

  const payments = await query(
    `
      SELECT sp.*, ts.currency
      FROM salary_payments sp
      JOIN teacher_salaries ts ON sp.teacher_salary_id = ts.id
      WHERE ts.teacher_id = $1
      ORDER BY sp.payment_date DESC, sp.created_at DESC
      LIMIT 12
    `,
    [teacherId],
    client,
  );

  return {
    currentSalary: salaries.rows.find((salary) => salary.is_active) || salaries.rows[0] || null,
    salaries: salaries.rows,
    payments: payments.rows,
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureTeacherProfilePhotoColumn();
    const { search, role } = req.query;

    if (role && role !== 'teacher') {
      const params = [role];
      const conditions = ['role = $1'];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
      }

      const users = await query(
        `
          SELECT id, name, email, role, is_active, created_at
          FROM users
          WHERE ${conditions.join(' AND ')}
          ORDER BY name
        `,
        params,
      );

      return res.json(users.rows);
    }

    const params = [];
    const conditions = ['t.is_active = true'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.first_name ILIKE $${params.length} OR t.last_name ILIKE $${params.length} OR t.email ILIKE $${params.length} OR t.employee_id ILIKE $${params.length})`);
    }

    const result = await query(
      `
        SELECT
          t.*,
          u.name AS user_name,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('id', c.id, 'name', c.name, 'grade_level', c.grade_level, 'room', c.room)
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'
          ) AS classes
        FROM teachers t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN classes c ON c.teacher_id = t.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY t.id, u.name
        ORDER BY t.first_name, t.last_name
      `,
      params,
    );

    return res.json(result.rows.map(mapTeacher));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureTeacherProfilePhotoColumn();
    const result = await query(
      `
        SELECT
          t.*,
          u.name AS user_name,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('id', c.id, 'name', c.name, 'grade_level', c.grade_level, 'room', c.room)
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'
          ) AS classes
        FROM teachers t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN classes c ON c.teacher_id = t.id
        WHERE t.id = $1 OR t.user_id = $1
        GROUP BY t.id, u.name
      `,
      [req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacher = mapTeacher(result.rows[0]);
    const compensation = await getTeacherCompensation(teacher.id);

    return res.json({ ...teacher, compensation });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/photo', authorize('admin'), async (req, res) => {
  try {
    await ensureTeacherProfilePhotoColumn();

    const { profile_photo_url } = req.body;
    const result = await query(
      `
        UPDATE teachers
        SET profile_photo_url = $1, updated_at = NOW()
        WHERE id = $2 OR user_id = $2
        RETURNING id, profile_photo_url
      `,
      [profile_photo_url || null, req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    await ensureTeacherProfilePhotoColumn();
    if (!req.body.password) {
      return res.status(400).json({ error: 'Password is required when creating staff accounts.' });
    }

    const created = await withTransaction(async (client) => {
      const {
        name,
        email,
        role = 'teacher',
        phone,
        password,
        employee_id,
        date_of_birth,
        gender,
        address,
        qualification,
        specialization,
        hire_date,
        salary,
      } = req.body;

      const hashed = await bcrypt.hash(password, 10);
      const user = await query(
        `
          INSERT INTO users (name, email, password_hash, role)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, email, role, is_active, created_at
        `,
        [name, email, hashed, role],
        client,
      );

      if (role !== 'teacher') {
        return user.rows[0];
      }

      const { firstName, lastName } = splitName(name);
      const teacher = await query(
        `
          INSERT INTO teachers (
            user_id, employee_id, first_name, last_name, email, phone, date_of_birth,
            gender, address, qualification, specialization, hire_date, salary, is_active, profile_photo_url
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, CURRENT_DATE),$13,true,$14)
          RETURNING *
        `,
        [
          user.rows[0].id,
          employee_id || `T-${Date.now()}`,
          firstName,
          lastName,
          email,
          phone || null,
          date_of_birth || null,
          gender || null,
          address || null,
          qualification || null,
          specialization || null,
          hire_date || null,
          salary || null,
          req.body.profile_photo_url || null,
        ],
        client,
      );

      return mapTeacher(teacher.rows[0]);
    });

    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    await ensureTeacherProfilePhotoColumn();
    const updated = await withTransaction(async (client) => {
      const {
        name,
        email,
        phone,
        is_active,
        employee_id,
        date_of_birth,
        gender,
        address,
        qualification,
        specialization,
        hire_date,
        salary,
        profile_photo_url,
      } = req.body;

      const existing = await query('SELECT * FROM teachers WHERE id = $1 OR user_id = $1', [req.params.id], client);

      if (!existing.rows.length) {
        const user = await query(
          `
            UPDATE users
            SET name = $1, email = $2, is_active = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, name, email, role, is_active, created_at
          `,
          [name, email, is_active, req.params.id],
          client,
        );

        return user.rows[0];
      }

      const teacher = existing.rows[0];
      const { firstName, lastName } = splitName(name || fullName(teacher));

      if (teacher.user_id) {
        await query(
          'UPDATE users SET name = $1, email = $2, is_active = $3, updated_at = NOW() WHERE id = $4',
          [name || fullName(teacher), email || teacher.email, is_active ?? teacher.is_active, teacher.user_id],
          client,
        );
      }

      const result = await query(
        `
          UPDATE teachers
          SET employee_id = $1, first_name = $2, last_name = $3, email = $4, phone = $5,
              date_of_birth = $6, gender = $7, address = $8, qualification = $9,
              specialization = $10, hire_date = $11, salary = $12, is_active = $13,
              profile_photo_url = $14, updated_at = NOW()
          WHERE id = $15
          RETURNING *
        `,
        [
          employee_id || teacher.employee_id,
          firstName,
          lastName,
          email || teacher.email,
          phone ?? teacher.phone,
          date_of_birth || teacher.date_of_birth,
          gender || teacher.gender,
          address ?? teacher.address,
          qualification ?? teacher.qualification,
          specialization ?? teacher.specialization,
          hire_date || teacher.hire_date,
          salary ?? teacher.salary,
          is_active ?? teacher.is_active,
          profile_photo_url ?? teacher.profile_photo_url,
          teacher.id,
        ],
        client,
      );

      return mapTeacher(result.rows[0]);
    });

    if (!updated) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      const teacher = await query('SELECT id, user_id FROM teachers WHERE id = $1 OR user_id = $1', [req.params.id], client);

      if (teacher.rows.length) {
        await query('UPDATE teachers SET is_active = false WHERE id = $1', [teacher.rows[0].id], client);

        if (teacher.rows[0].user_id) {
          await query('UPDATE users SET is_active = false WHERE id = $1', [teacher.rows[0].user_id], client);
        }

        return;
      }

      await query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id], client);
    });

    return res.json({ message: 'Staff deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
