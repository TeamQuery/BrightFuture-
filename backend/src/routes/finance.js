import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Fee categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM fee_categories ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authorize('admin','accountant'), async (req, res) => {
  try {
    const { name, description, amount, frequency } = req.body;
    const result = await query(`
      INSERT INTO fee_categories (name, description, amount, frequency) VALUES ($1,$2,$3,$4) RETURNING *
    `, [name, description, amount, frequency]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fee payments
router.get('/payments', async (req, res) => {
  try {
    const { student_id, status, academic_year, term } = req.query;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (student_id) { conditions.push(`fp.student_id = $${pIdx}`); params.push(student_id); pIdx++; }
    if (status) { conditions.push(`fp.status = $${pIdx}`); params.push(status); pIdx++; }
    if (academic_year) { conditions.push(`fp.academic_year = $${pIdx}`); params.push(academic_year); pIdx++; }
    if (term) { conditions.push(`fp.term = $${pIdx}`); params.push(term); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT fp.*, fc.name as category_name, s.first_name, s.last_name, s.student_id as sid
      FROM fee_payments fp JOIN fee_categories fc ON fp.category_id = fc.id
      JOIN students s ON fp.student_id = s.id ${where} ORDER BY fp.payment_date DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', authorize('admin','accountant'), async (req, res) => {
  try {
    const { student_id, category_id, amount_paid, payment_method, reference_number, academic_year, term, status, notes } = req.body;
    const result = await query(`
      INSERT INTO fee_payments (student_id, category_id, amount_paid, payment_method, reference_number, academic_year, term, status, notes, received_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [student_id, category_id, amount_paid, payment_method, reference_number, academic_year, term, status, notes, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const { academic_year, term } = req.query;
    const conditions = [];
    const params = [];
    let pIdx = 1;
    if (academic_year) { conditions.push(`academic_year = $${pIdx}`); params.push(academic_year); pIdx++; }
    if (term) { conditions.push(`term = $${pIdx}`); params.push(term); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT 
        SUM(amount_paid) FILTER (WHERE status='paid') as total_collected,
        SUM(amount_paid) FILTER (WHERE status='pending') as total_pending,
        COUNT(*) FILTER (WHERE status='paid') as paid_count,
        COUNT(*) FILTER (WHERE status='pending') as pending_count,
        COUNT(DISTINCT student_id) as students_paid
      FROM fee_payments ${where}
    `, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
