import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, role } = req.query;
    let conditions = ["role IN ('teacher','admin','librarian','accountant')"];
    let params = [];
    let pIdx = 1;
    if (search) { conditions.push(`(name ILIKE $${pIdx} OR email ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++; }
    if (role) { conditions.push(`role = $${pIdx}`); params.push(role); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT id,name,email,role,phone,is_active,created_at FROM users ${where} ORDER BY name`, params);
    
    // For each teacher, get their class
    const teachers = await Promise.all(result.rows.map(async (t) => {
      const cls = await query('SELECT name, grade_level FROM classes WHERE teacher_id = $1', [t.id]);
      return { ...t, classes: cls.rows };
    }));
    res.json(teachers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT id,name,email,role,phone,is_active,created_at FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Staff not found' });
    const classes = await query('SELECT * FROM classes WHERE teacher_id = $1', [req.params.id]);
    res.json({ ...result.rows[0], classes: classes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, phone, password = 'password123' } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const result = await query(`
      INSERT INTO users (name, email, password, role, phone) VALUES ($1,$2,$3,$4,$5)
      RETURNING id,name,email,role,phone,is_active,created_at
    `, [name, email, hashed, role, phone]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, phone, is_active } = req.body;
    const result = await query(`
      UPDATE users SET name=$1, email=$2, role=$3, phone=$4, is_active=$5, updated_at=NOW()
      WHERE id=$6 RETURNING id,name,email,role,phone,is_active,created_at
    `, [name, email, role, phone, is_active, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Staff deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
