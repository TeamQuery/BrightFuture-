import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

let profilePhotoColumnReady;

async function ensureProfilePhotoColumn() {
  if (!profilePhotoColumnReady) {
    profilePhotoColumnReady = query('ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_photo_url TEXT');
  }

  return profilePhotoColumnReady;
}

function emptyToNull(value) {
  return value === '' || value === undefined ? null : value;
}

function normalizeGender(value) {
  if (!value) {
    return null;
  }

  return String(value).trim().toLowerCase();
}

function applyStudentScope(req, conditions, params, alias = 's') {
  if (req.user.role === 'admin') {
    return;
  }

  if (req.user.role === 'teacher') {
    params.push(req.user.id);
    conditions.push(`EXISTS (
      SELECT 1
      FROM teachers t
      JOIN classes tc ON tc.teacher_id = t.id
      WHERE t.user_id = $${params.length}
        AND tc.id = ${alias}.class_id
    )`);
    return;
  }

  if (req.user.role === 'parent') {
    params.push(req.user.id);
    params.push(req.user.email);
    conditions.push(`EXISTS (
      SELECT 1
      FROM student_parents scoped_sp
      JOIN parents scoped_p ON scoped_p.id = scoped_sp.parent_id
      WHERE scoped_sp.student_id = ${alias}.id
        AND (scoped_p.user_id = $${params.length - 1} OR lower(scoped_p.email) = lower($${params.length}))
    )`);
    return;
  }

  params.push(req.user.id);
  conditions.push(`${alias}.user_id = $${params.length}`);
}

async function canAccessStudent(req, studentId) {
  const conditions = ['s.id = $1'];
  const params = [studentId];
  applyStudentScope(req, conditions, params);
  const result = await query(
    `SELECT 1 FROM students s WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params,
  );

  return result.rows.length > 0;
}

router.get('/', async (req, res) => {
  try {
    await ensureProfilePhotoColumn();
    const { page = 1, limit = 20, search, class_id, status } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (search) { conditions.push(`(s.first_name ILIKE $${pIdx} OR s.last_name ILIKE $${pIdx} OR s.student_id ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++; }
    if (class_id) { conditions.push(`s.class_id = $${pIdx}`); params.push(class_id); pIdx++; }
    if (status) { conditions.push(`s.status = $${pIdx}`); params.push(status); pIdx++; }
    applyStudentScope(req, conditions, params);
    pIdx = params.length + 1;
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM students s ${where}`, params);
    const result = await query(`
      SELECT s.*, c.name as class_name, c.grade_level
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      ${where} ORDER BY s.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx+1}
    `, [...params, limit, offset]);
    res.json({ students: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureProfilePhotoColumn();
    const conditions = ['s.id = $1'];
    const params = [req.params.id];
    applyStudentScope(req, conditions, params);
    const result = await query(`
      SELECT s.*, u.email, c.name as class_name, c.grade_level
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE ${conditions.join(' AND ')}
    `, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Student not found' });
    const parents = await query(`
      SELECT p.*, sp.relationship as student_relationship, sp.is_primary as student_primary_contact
      FROM parents p
      JOIN student_parents sp ON p.id = sp.parent_id
      WHERE sp.student_id = $1
      ORDER BY sp.is_primary DESC, p.first_name, p.last_name
    `, [req.params.id]);
    res.json({ ...result.rows[0], parents: parents.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/photo', authorize('admin'), async (req, res) => {
  try {
    await ensureProfilePhotoColumn();

    const { profile_photo_url } = req.body;
    const result = await query(`
      UPDATE students
      SET profile_photo_url = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, profile_photo_url
    `, [emptyToNull(profile_photo_url), req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    await ensureProfilePhotoColumn();
    const { student_id, first_name, last_name, date_of_birth, gender, address, class_id, blood_group, medical_notes } = req.body;
    const result = await query(`
      INSERT INTO students (student_id, first_name, last_name, date_of_birth, gender, address, class_id, blood_group, medical_info)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      student_id,
      first_name,
      last_name,
      emptyToNull(date_of_birth),
      normalizeGender(gender),
      emptyToNull(address),
      emptyToNull(class_id),
      emptyToNull(blood_group),
      emptyToNull(medical_notes),
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    await ensureProfilePhotoColumn();
    const { first_name, last_name, date_of_birth, gender, address, class_id, status, blood_group, medical_notes } = req.body;
    const result = await query(`
      UPDATE students SET first_name=$1, last_name=$2, date_of_birth=$3, gender=$4, address=$5, class_id=$6, status=$7, blood_group=$8, medical_info=$9, updated_at=NOW()
      WHERE id=$10 RETURNING *
    `, [
      first_name,
      last_name,
      emptyToNull(date_of_birth),
      normalizeGender(gender),
      emptyToNull(address),
      emptyToNull(class_id),
      status || 'active',
      emptyToNull(blood_group),
      emptyToNull(medical_notes),
      req.params.id,
    ]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM students WHERE id = $1', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/grades', async (req, res) => {
  try {
    if (!(await canAccessStudent(req, req.params.id))) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await query(`
      SELECT g.*, e.name as exam_name, e.total_marks, e.exam_type, e.exam_date, s.name as subject_name
      FROM grades g JOIN exams e ON g.exam_id = e.id JOIN subjects s ON e.subject_id = s.id
      WHERE g.student_id = $1 ORDER BY e.exam_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/attendance', async (req, res) => {
  try {
    if (!(await canAccessStudent(req, req.params.id))) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await query(`
      SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 60
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/fees', async (req, res) => {
  try {
    if (!(await canAccessStudent(req, req.params.id))) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await query(`
      SELECT
        p.*,
        sf.student_id,
        sf.academic_year,
        sf.status,
        sf.amount,
        sf.paid_amount,
        fc.name as category_name
      FROM student_fees sf
      JOIN finance_fee_categories fc ON sf.fee_category_id = fc.id
      LEFT JOIN payments p ON p.student_fee_id = sf.id
      WHERE sf.student_id = $1
      ORDER BY COALESCE(p.payment_date, sf.due_date) DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
