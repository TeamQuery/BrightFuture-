import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Events
router.get('/events', async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.name as created_by_name FROM events e LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.event_date DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', authorize('admin'), async (req, res) => {
  try {
    const { title, description, event_date, end_date, event_type, target_audience } = req.body;
    const result = await query(`
      INSERT INTO events (title, description, event_date, end_date, event_type, target_audience, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [title, description, event_date, end_date, event_type, target_audience, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [students, teachers, classes, books, feeCollected, attendanceToday, upcomingEvents, overdueBorrowings] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active FROM students`),
      query(`SELECT COUNT(*) as total FROM users WHERE role = 'teacher' AND is_active = true`),
      query(`SELECT COUNT(*) as total FROM classes`),
      query(`SELECT COUNT(*) as total, SUM(available_copies) as available FROM library_books`),
      query(`SELECT COALESCE(SUM(amount_paid),0) as total FROM fee_payments WHERE status='paid' AND academic_year='2024/2025'`),
      query(`SELECT COUNT(*) FILTER (WHERE status='present') as present, COUNT(*) FILTER (WHERE status='absent') as absent, COUNT(*) as total FROM attendance WHERE date = CURRENT_DATE`),
      query(`SELECT * FROM events WHERE event_date >= CURRENT_DATE ORDER BY event_date LIMIT 5`),
      query(`SELECT COUNT(*) as total FROM book_borrowings WHERE status='overdue'`),
    ]);

    const recentStudents = await query(`
      SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.created_at DESC LIMIT 5
    `);

    const feeByCategory = await query(`
      SELECT fc.name, SUM(fp.amount_paid) as total FROM fee_payments fp
      JOIN fee_categories fc ON fp.category_id = fc.id WHERE fp.status='paid'
      GROUP BY fc.name ORDER BY total DESC LIMIT 5
    `);

    const attendanceWeek = await query(`
      SELECT date, 
        COUNT(*) FILTER (WHERE status='present') as present,
        COUNT(*) FILTER (WHERE status='absent') as absent,
        COUNT(*) as total
      FROM attendance WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY date ORDER BY date
    `);

    res.json({
      stats: {
        students: students.rows[0],
        teachers: teachers.rows[0],
        classes: classes.rows[0],
        books: books.rows[0],
        feeCollected: feeCollected.rows[0],
        attendanceToday: attendanceToday.rows[0],
        overdueBorrowings: overdueBorrowings.rows[0],
      },
      upcomingEvents: upcomingEvents.rows,
      recentStudents: recentStudents.rows,
      feeByCategory: feeByCategory.rows,
      attendanceWeek: attendanceWeek.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Parents
router.get('/parents', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.email as user_email,
        (SELECT COUNT(*) FROM student_parents sp WHERE sp.parent_id = p.id) as children_count
      FROM parents p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.first_name
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/parents/:id', async (req, res) => {
  try {
    const parent = await query('SELECT * FROM parents WHERE id = $1', [req.params.id]);
    if (!parent.rows.length) return res.status(404).json({ error: 'Parent not found' });
    const children = await query(`
      SELECT s.*, c.name as class_name FROM students s
      JOIN student_parents sp ON s.id = sp.student_id
      JOIN classes c ON s.class_id = c.id WHERE sp.parent_id = $1
    `, [req.params.id]);
    res.json({ ...parent.rows[0], children: children.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
