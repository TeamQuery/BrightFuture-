import express from 'express';
import { query, withTransaction } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

function normalizePaymentStatus(status) {
  if (status === 'partial') {
    return 'partially_paid';
  }

  return status || 'paid';
}

function normalizePaymentMethod(method) {
  if (method === 'mobile_money') {
    return 'online';
  }

  if (method === 'card') {
    return 'debit_card';
  }

  return method || 'cash';
}

function applyFinanceStudentScope(req, conditions, params, studentExpression = 'sf.student_id') {
  if (['admin', 'accountant'].includes(req.user.role)) {
    return;
  }

  if (req.user.role === 'parent') {
    params.push(req.user.id);
    params.push(req.user.email);
    conditions.push(`EXISTS (
      SELECT 1
      FROM student_parents scoped_sp
      JOIN parents scoped_p ON scoped_p.id = scoped_sp.parent_id
      WHERE scoped_sp.student_id = ${studentExpression}
        AND (scoped_p.user_id = $${params.length - 1} OR lower(scoped_p.email) = lower($${params.length}))
    )`);
    return;
  }

  params.push(req.user.id);
  conditions.push(`EXISTS (
    SELECT 1 FROM students scoped_s
    WHERE scoped_s.id = ${studentExpression}
      AND scoped_s.user_id = $${params.length}
  )`);
}

// Fee categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM finance_fee_categories ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authorize('admin','accountant'), async (req, res) => {
  try {
    const { name, description, amount, frequency, grade_level } = req.body;
    const result = await query(`
      INSERT INTO finance_fee_categories (name, description, amount, frequency, grade_level)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [name, description, amount, frequency, grade_level || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fee payments
router.get('/payments', async (req, res) => {
  try {
    const { student_id, status, academic_year } = req.query;
    const conditions = [];
    const params = [];

    if (student_id) { params.push(student_id); conditions.push(`sf.student_id = $${params.length}`); }
    if (status) { params.push(normalizePaymentStatus(status)); conditions.push(`sf.status = $${params.length}`); }
    if (academic_year) { params.push(academic_year); conditions.push(`sf.academic_year = $${params.length}`); }
    applyFinanceStudentScope(req, conditions, params);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT
        COALESCE(p.id, sf.id) as id,
        sf.student_id,
        sf.academic_year,
        sf.status,
        sf.amount,
        sf.paid_amount as amount_paid,
        p.payment_method,
        p.transaction_id as reference_number,
        p.payment_date,
        p.notes,
        fc.name as category_name,
        s.first_name,
        s.last_name,
        s.student_id as sid
      FROM student_fees sf
      JOIN finance_fee_categories fc ON sf.fee_category_id = fc.id
      JOIN students s ON sf.student_id = s.id
      LEFT JOIN payments p ON p.student_fee_id = sf.id
      ${where}
      ORDER BY COALESCE(p.payment_date, sf.due_date) DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', authorize('admin','accountant'), async (req, res) => {
  try {
    const created = await withTransaction(async (client) => {
      const {
        student_id,
        category_id,
        amount_paid,
        payment_method,
        reference_number,
        academic_year = '2024/2025',
        status,
        notes,
      } = req.body;
      const amount = Number(amount_paid || 0);
      const normalizedStatus = normalizePaymentStatus(status);

      const feeResult = await query(`
        INSERT INTO student_fees (
          student_id, fee_category_id, academic_year, amount, due_date, paid_amount, status, notes
        )
        VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7)
        ON CONFLICT (student_id, fee_category_id, academic_year)
        DO UPDATE SET
          paid_amount = student_fees.paid_amount + EXCLUDED.paid_amount,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *
      `, [student_id, category_id, academic_year, amount, amount, normalizedStatus, notes || null], client);

      const payment = await query(`
        INSERT INTO payments (
          student_fee_id, amount, payment_method, transaction_id, received_by, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [
        feeResult.rows[0].id,
        amount,
        normalizePaymentMethod(payment_method),
        reference_number || null,
        req.user.id,
        notes || null,
      ], client);

      return payment.rows[0];
    });

    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const { academic_year } = req.query;
    const conditions = [];
    const params = [];
    if (academic_year) { params.push(academic_year); conditions.push(`sf.academic_year = $${params.length}`); }
    applyFinanceStudentScope(req, conditions, params);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT
        COALESCE(SUM(sf.paid_amount) FILTER (WHERE sf.status IN ('paid', 'partially_paid')), 0) as total_collected,
        COALESCE(SUM(sf.amount - sf.paid_amount) FILTER (WHERE sf.status IN ('pending', 'partially_paid', 'overdue')), 0) as total_pending,
        COUNT(*) FILTER (WHERE sf.status='paid') as paid_count,
        COUNT(*) FILTER (WHERE sf.status IN ('pending', 'partially_paid', 'overdue')) as pending_count,
        COUNT(DISTINCT sf.student_id) FILTER (WHERE sf.paid_amount > 0) as students_paid
      FROM student_fees sf
      ${where}
    `, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
