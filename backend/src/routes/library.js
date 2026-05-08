import express from 'express';
import { query, withTransaction } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

let borrowingFineColumnReady;

async function ensureBorrowingFineColumn() {
  if (!borrowingFineColumnReady) {
    borrowingFineColumnReady = query('ALTER TABLE library_borrowings ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10,2) DEFAULT 0');
  }

  return borrowingFineColumnReady;
}

router.get('/stats', async (_req, res) => {
  try {
    await ensureBorrowingFineColumn();
    const result = await query(`
      SELECT
        COUNT(*)::int as total_titles,
        COALESCE(SUM(total_copies), 0)::int as total_copies,
        COALESCE(SUM(available_copies), 0)::int as available_copies,
        (SELECT COUNT(*)::int FROM library_borrowings WHERE status = 'borrowed') as borrowed_count,
        (SELECT COUNT(*)::int FROM library_borrowings WHERE status = 'overdue') as overdue_count
      FROM library_books
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    const { title, author, isbn, category, publisher, publish_year, publication_year, total_copies, location, description } = req.body;
    const result = await query(`
      INSERT INTO library_books (title, author, isbn, category, publisher, publication_year, total_copies, available_copies, location, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *
    `, [title, author, isbn || null, category || 'General', publisher || null, publication_year || publish_year || null, total_copies || 1, location || 'Main Library', description || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/books/:id', authorize('admin','librarian'), async (req, res) => {
  try {
    const { title, author, isbn, category, publisher, publish_year, publication_year, total_copies, available_copies, location, description } = req.body;
    const result = await query(`
      UPDATE library_books
      SET title=$1, author=$2, isbn=$3, category=$4, publisher=$5, publication_year=$6,
          total_copies=$7, available_copies=$8, location=$9, description=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [title, author, isbn || null, category || 'General', publisher || null, publication_year || publish_year || null, total_copies, available_copies, location, description, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/borrowings', async (req, res) => {
  try {
    await ensureBorrowingFineColumn();
    const { status } = req.query;
    let q = `
      SELECT lbw.*, lb.title as book_title, lb.author, u.name as borrower_name, u.role as borrower_type
      FROM library_borrowings lbw
      JOIN library_books lb ON lbw.book_id = lb.id
      JOIN users u ON lbw.borrower_id = u.id
    `;
    const params = [];
    if (status) { q += ` WHERE lbw.status = $1`; params.push(status); }
    q += ` ORDER BY lbw.borrow_date DESC`;
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/borrow', authorize('admin','librarian'), async (req, res) => {
  try {
    await ensureBorrowingFineColumn();
    const created = await withTransaction(async (client) => {
      const { book_id, borrower_id, due_date } = req.body;
      const bookCheck = await query('SELECT available_copies FROM library_books WHERE id = $1', [book_id], client);
      if (!bookCheck.rows.length || bookCheck.rows[0].available_copies < 1) {
        const error = new Error('Book not available');
        error.statusCode = 400;
        throw error;
      }

      const result = await query(`
        INSERT INTO library_borrowings (book_id, borrower_id, due_date, issued_by)
        VALUES ($1,$2,$3,$4) RETURNING *
      `, [book_id, borrower_id, due_date, req.user.id], client);
      await query('UPDATE library_books SET available_copies = available_copies - 1 WHERE id = $1', [book_id], client);
      return result.rows[0];
    });

    res.status(201).json(created);
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

router.put('/return/:id', authorize('admin','librarian'), async (req, res) => {
  try {
    await ensureBorrowingFineColumn();
    const returned = await withTransaction(async (client) => {
      const borrowing = await query('SELECT * FROM library_borrowings WHERE id = $1', [req.params.id], client);
      if (!borrowing.rows.length) {
        const error = new Error('Borrowing not found');
        error.statusCode = 404;
        throw error;
      }

      const due = new Date(borrowing.rows[0].due_date);
      const today = new Date();
      const daysLate = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
      const fine = daysLate * 0.5;
      const result = await query(`
        UPDATE library_borrowings
        SET status='returned', return_date=CURRENT_DATE, fine_amount=$1, updated_at=NOW()
        WHERE id=$2 RETURNING *
      `, [fine, req.params.id], client);
      await query('UPDATE library_books SET available_copies = available_copies + 1 WHERE id = $1', [borrowing.rows[0].book_id], client);
      return result.rows[0];
    });

    res.json(returned);
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

export default router;
