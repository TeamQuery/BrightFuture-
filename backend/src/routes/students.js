import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, class_id, status } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (search) { conditions.push(`(s.first_name ILIKE $${pIdx} OR s.last_name ILIKE $${pIdx} OR s.student_id ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++; }
    if (class_id) { conditions.push(`s.class_id = $${pIdx}`); params.push(class_id); pIdx++; }
    if (status) { conditions.push(`s.status = $${pIdx}`); params.push(status); pIdx++; }
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
    const result = await query(`
      SELECT s.*, c.name as class_name, c.grade_level
      FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Student not found' });
    const parents = await query(`
      SELECT p.* FROM parents p JOIN student_parents sp ON p.id = sp.parent_id WHERE sp.student_id = $1
    `, [req.params.id]);
    res.json({ ...result.rows[0], parents: parents.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { student_id, first_name, last_name, date_of_birth, gender, address, class_id, blood_group, medical_notes } = req.body;
    const result = await query(`
      INSERT INTO students (student_id, first_name, last_name, date_of_birth, gender, address, class_id, blood_group, medical_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [student_id, first_name, last_name, date_of_birth, gender, address, class_id, blood_group, medical_notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, gender, address, class_id, status, blood_group, medical_notes } = req.body;
    const result = await query(`
      UPDATE students SET first_name=$1, last_name=$2, date_of_birth=$3, gender=$4, address=$5, class_id=$6, status=$7, blood_group=$8, medical_notes=$9, updated_at=NOW()
      WHERE id=$10 RETURNING *
    `, [first_name, last_name, date_of_birth, gender, address, class_id, status, blood_group, medical_notes, req.params.id]);
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
    const result = await query(`
      SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 60
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/fees', async (req, res) => {
  try {
    const result = await query(`
      SELECT fp.*, fc.name as category_name FROM fee_payments fp JOIN fee_categories fc ON fp.category_id = fc.id
      WHERE fp.student_id = $1 ORDER BY fp.payment_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
