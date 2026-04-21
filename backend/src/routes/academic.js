import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Classes
router.get('/classes', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'active') as student_count
      FROM classes c LEFT JOIN users u ON c.teacher_id = u.id ORDER BY c.grade_level, c.section
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes', authorize('admin'), async (req, res) => {
  try {
    const { name, grade_level, section, capacity, room, teacher_id, academic_year } = req.body;
    const result = await query(`
      INSERT INTO classes (name, grade_level, section, capacity, room, teacher_id, academic_year)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [name, grade_level, section, capacity, room, teacher_id, academic_year]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Subjects
router.get('/subjects', async (req, res) => {
  try {
    const result = await query('SELECT * FROM subjects ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subjects', authorize('admin'), async (req, res) => {
  try {
    const { name, code, description, grade_level, credits } = req.body;
    const result = await query(`
      INSERT INTO subjects (name, code, description, grade_level, credits) VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [name, code, description, grade_level, credits]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Timetable
router.get('/timetable', async (req, res) => {
  try {
    const { class_id } = req.query;
    let q = `SELECT t.*, s.name as subject_name, s.code, u.name as teacher_name, c.name as class_name
      FROM timetable t JOIN subjects s ON t.subject_id = s.id JOIN classes c ON t.class_id = c.id
      LEFT JOIN users u ON t.teacher_id = u.id`;
    const params = [];
    if (class_id) { q += ` WHERE t.class_id = $1`; params.push(class_id); }
    q += ` ORDER BY CASE day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 END, t.start_time`;
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/timetable', authorize('admin','teacher'), async (req, res) => {
  try {
    const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, academic_year } = req.body;
    const result = await query(`
      INSERT INTO timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, academic_year)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, academic_year]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Attendance
router.get('/attendance', async (req, res) => {
  try {
    const { class_id, date, student_id } = req.query;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (class_id) { conditions.push(`a.class_id = $${pIdx}`); params.push(class_id); pIdx++; }
    if (date) { conditions.push(`a.date = $${pIdx}`); params.push(date); pIdx++; }
    if (student_id) { conditions.push(`a.student_id = $${pIdx}`); params.push(student_id); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT a.*, s.first_name, s.last_name, s.student_id FROM attendance a
      JOIN students s ON a.student_id = s.id ${where} ORDER BY s.first_name
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/attendance', authorize('admin','teacher'), async (req, res) => {
  try {
    const records = req.body; // array of {student_id, class_id, date, status, notes}
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected array of attendance records' });
    const results = await Promise.all(records.map(r => query(`
      INSERT INTO attendance (student_id, class_id, date, status, notes, marked_by)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id, date) DO UPDATE SET status=$4, notes=$5
      RETURNING *
    `, [r.student_id, r.class_id, r.date, r.status, r.notes, req.user.id])));
    res.status(201).json(results.map(r => r.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attendance/summary', async (req, res) => {
  try {
    const { month, year, class_id } = req.query;
    const result = await query(`
      SELECT student_id, 
        COUNT(*) FILTER (WHERE status='present') as present,
        COUNT(*) FILTER (WHERE status='absent') as absent,
        COUNT(*) FILTER (WHERE status='late') as late,
        COUNT(*) FILTER (WHERE status='excused') as excused,
        COUNT(*) as total
      FROM attendance
      WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2
      ${class_id ? 'AND class_id = $3' : ''}
      GROUP BY student_id
    `, class_id ? [month, year, class_id] : [month, year]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Exams
router.get('/exams', async (req, res) => {
  try {
    const { class_id, academic_year } = req.query;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (class_id) { conditions.push(`e.class_id = $${pIdx}`); params.push(class_id); pIdx++; }
    if (academic_year) { conditions.push(`e.academic_year = $${pIdx}`); params.push(academic_year); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT e.*, s.name as subject_name, c.name as class_name FROM exams e
      JOIN subjects s ON e.subject_id = s.id JOIN classes c ON e.class_id = c.id
      ${where} ORDER BY e.exam_date DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/exams', authorize('admin','teacher'), async (req, res) => {
  try {
    const { name, subject_id, class_id, exam_date, total_marks, passing_marks, exam_type, academic_year, term } = req.body;
    const result = await query(`
      INSERT INTO exams (name, subject_id, class_id, exam_date, total_marks, passing_marks, exam_type, academic_year, term)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [name, subject_id, class_id, exam_date, total_marks, passing_marks, exam_type, academic_year, term]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Grades
router.get('/grades', async (req, res) => {
  try {
    const { exam_id, class_id } = req.query;
    let q = `SELECT g.*, s.first_name, s.last_name, s.student_id as sid, e.name as exam_name, e.total_marks, sub.name as subject_name
      FROM grades g JOIN students s ON g.student_id = s.id JOIN exams e ON g.exam_id = e.id JOIN subjects sub ON e.subject_id = sub.id`;
    const params = [];
    if (exam_id) { q += ` WHERE g.exam_id = $1`; params.push(exam_id); }
    else if (class_id) { q += ` WHERE s.class_id = $1`; params.push(class_id); }
    q += ` ORDER BY s.first_name`;
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/grades', authorize('admin','teacher'), async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    const results = await Promise.all(records.map(r => {
      const pct = (r.marks_obtained / r.total_marks) * 100;
      const letter = pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
      return query(`
        INSERT INTO grades (student_id, exam_id, marks_obtained, grade_letter, remarks, graded_by)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id, exam_id) DO UPDATE SET marks_obtained=$3, grade_letter=$4, remarks=$5
        RETURNING *
      `, [r.student_id, r.exam_id, r.marks_obtained, letter, r.remarks, req.user.id]);
    }));
    res.status(201).json(results.map(r => r.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
