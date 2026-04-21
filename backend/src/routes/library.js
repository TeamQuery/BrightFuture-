import express from 'express';
import { query } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/books', async (req, res) => {
  try {
    const { search, category } = req.query;
    let conditions = [];
    let params = [];
    let pIdx = 1;
    if (search) { conditions.push(`(title ILIKE $${pIdx} OR author ILIKE $${pIdx} OR isbn ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++; }
    if (category) { conditions.push(`category = $${pIdx}`); params.push(category); pIdx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM library_books ${where} ORDER BY title`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/books', authorize('admin','librarian'), async (req, res) => {
  try {
    const { title, author, isbn, category, publisher, publish_year, total_copies, location, description } = req.body;
    const result = await query(`
      INSERT INTO library_books (title, author, isbn, category, publisher, publish_year, total_copies, available_copies, location, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *
    `, [title, author, isbn, category, publisher, publish_year, total_copies, location, description]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/books/:id', authorize('admin','librarian'), async (req, res) => {
  try {
    const { title, author, isbn, category, publisher, publish_year, total_copies, available_copies, location, description } = req.body;
    const result = await query(`
      UPDATE library_books SET title=$1, author=$2, isbn=$3, category=$4, publisher=$5, publish_year=$6, total_copies=$7, available_copies=$8, location=$9, description=$10
      WHERE id=$11 RETURNING *
    `, [title, author, isbn, category, publisher, publish_year, total_copies, available_copies, location, description, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/borrowings', async (req, res) => {
  try {
    const { status } = req.query;
    let q = `SELECT bb.*, lb.title as book_title, lb.author FROM book_borrowings bb JOIN library_books lb ON bb.book_id = lb.id`;
    const params = [];
    if (status) { q += ` WHERE bb.status = $1`; params.push(status); }
    q += ` ORDER BY bb.borrow_date DESC`;
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/borrow', authorize('admin','librarian'), async (req, res) => {
  try {
    const { book_id, borrower_type, borrower_id, due_date } = req.body;
    const bookCheck = await query('SELECT available_copies FROM library_books WHERE id = $1', [book_id]);
    if (!bookCheck.rows.length || bookCheck.rows[0].available_copies < 1) {
      return res.status(400).json({ error: 'Book not available' });
    }
    const result = await query(`
      INSERT INTO book_borrowings (book_id, borrower_type, borrower_id, due_date, issued_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [book_id, borrower_type, borrower_id, due_date, req.user.id]);
    await query('UPDATE library_books SET available_copies = available_copies - 1 WHERE id = $1', [book_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/return/:id', authorize('admin','librarian'), async (req, res) => {
  try {
    const borrowing = await query('SELECT * FROM book_borrowings WHERE id = $1', [req.params.id]);
    if (!borrowing.rows.length) return res.status(404).json({ error: 'Borrowing not found' });
    const due = new Date(borrowing.rows[0].due_date);
    const today = new Date();
    const daysLate = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
    const fine = daysLate * 0.5;
    const result = await query(`
      UPDATE book_borrowings SET status='returned', return_date=CURRENT_DATE, fine_amount=$1 WHERE id=$2 RETURNING *
    `, [fine, req.params.id]);
    await query('UPDATE library_books SET available_copies = available_copies + 1 WHERE id = $1', [borrowing.rows[0].book_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
