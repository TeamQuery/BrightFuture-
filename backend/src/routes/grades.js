import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Get grades for a student or all grades
router.get('/', async (req, res) => {
  try {
    const { student_id, class_id, subject_id, term } = req.query;
    let conditions = [];
    let params = [];
    let pIdx = 1;

    if (student_id) {
      conditions.push(`g.student_id = $${pIdx}`);
      params.push(student_id);
      pIdx++;
    }

    if (class_id) {
      conditions.push(`g.class_id = $${pIdx}`);
      params.push(class_id);
      pIdx++;
    }

    if (subject_id) {
      conditions.push(`g.subject_id = $${pIdx}`);
      params.push(subject_id);
      pIdx++;
    }

    if (term) {
      conditions.push(`g.term = $${pIdx}`);
      params.push(term);
      pIdx++;
    }

    // Role-based access
    if (req.user.role === 'student') {
      conditions.push(`g.student_id = $${pIdx}`);
      params.push(req.user.id);
      pIdx++;
    } else if (req.user.role === 'parent') {
      // Parents can see their children's grades
      const children = await query('SELECT student_id FROM student_parents WHERE parent_id = $1', [req.user.id]);
      const childIds = children.rows.map(c => c.student_id);
      if (childIds.length === 0) {
        return res.json({ grades: [] });
      }
      conditions.push(`g.student_id = ANY($${pIdx})`);
      params.push(childIds);
      pIdx++;
    } else if (req.user.role === 'teacher') {
      // Teachers can see grades for their classes
      const teacherClasses = await query('SELECT id FROM classes WHERE teacher_id = $1', [req.user.id]);
      const classIds = teacherClasses.rows.map(c => c.id);
      if (classIds.length > 0) {
        conditions.push(`g.class_id = ANY($${pIdx})`);
        params.push(classIds);
        pIdx++;
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT g.*, s.first_name, s.last_name, sub.name as subject_name, c.name as class_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN subjects sub ON g.subject_id = sub.id
      JOIN classes c ON g.class_id = c.id
      ${where}
      ORDER BY g.created_at DESC
    `, params);

    res.json({ grades: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create grade
router.post('/', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { student_id, subject_id, class_id, grade, term, comments } = req.body;

    // Check if teacher teaches this class
    if (req.user.role === 'teacher') {
      const classCheck = await query('SELECT teacher_id FROM classes WHERE id = $1', [class_id]);
      if (classCheck.rows[0].teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only add grades for your classes' });
      }
    }

    const result = await query(`
      INSERT INTO grades (student_id, subject_id, class_id, grade, term, comments)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [student_id, subject_id, class_id, grade, term, comments]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update grade
router.put('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { grade, comments } = req.body;
    const gradeId = req.params.id;

    // Check ownership for teacher
    if (req.user.role === 'teacher') {
      const gradeCheck = await query(`
        SELECT c.teacher_id FROM grades g
        JOIN classes c ON g.class_id = c.id
        WHERE g.id = $1
      `, [gradeId]);
      if (gradeCheck.rows[0].teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update grades for your classes' });
      }
    }

    const result = await query(`
      UPDATE grades SET grade = $1, comments = $2, updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [grade, comments, gradeId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;