'use client';
import { useEffect, useState } from 'react';
import { getBooks, getBorrowings, createBook, borrowBook, returnBook } from '@/lib/api';
import { Plus, Search, BookOpen, RotateCcw, BookMarked } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const emptyBook = { title:'', author:'', isbn:'', category:'', publisher:'', publish_year:'', total_copies:1, location:'', description:'' };
const categories = ['Mathematics','Language Arts','Science','Social Studies','Arts','Health Science','ICT','Fiction','Folklore','Reference'];

export default function LibraryPage() {
  const [tab, setTab] = useState('Books');
  const [books, setBooks] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddBook, setShowAddBook] = useState(false);
  const [form, setForm] = useState(emptyBook);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      getBooks({ search: search || undefined }),
      getBorrowings({ status: statusFilter || undefined }),
    ]).then(([b, bw]) => { setBooks(b.data); setBorrowings(bw.data); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const handleAddBook = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createBook(form); toast.success('Book added!'); setShowAddBook(false); setForm(emptyBook); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleReturn = async (id) => {
    try { const r = await returnBook(id); toast.success(`Returned! Fine: GH₵${r.data.fine_amount}`); load(); }
    catch { toast.error('Failed to return'); }
  };

  const statusBadge = { borrowed:'bg-blue-100 text-blue-700', returned:'bg-green-100 text-green-700', overdue:'badge-overdue' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{books.length} books in collection</p>
        </div>
        <button onClick={() => setShowAddBook(true)} className="btn-primary"><Plus size={16} /> Add Book</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card stat-blue text-white rounded-2xl">
          <BookOpen size={20} className="mb-2 opacity-80" />
          <div className="text-2xl font-bold">{books.length}</div>
          <div className="text-white/70 text-xs">Total Titles</div>
        </div>
        <div className="card stat-purple text-white rounded-2xl">
          <BookMarked size={20} className="mb-2 opacity-80" />
          <div className="text-2xl font-bold">{borrowings.filter(b=>b.status==='borrowed').length}</div>
          <div className="text-white/70 text-xs">Currently Borrowed</div>
        </div>
        <div className="card stat-orange text-white rounded-2xl">
          <RotateCcw size={20} className="mb-2 opacity-80" />
          <div className="text-2xl font-bold">{borrowings.filter(b=>b.status==='overdue').length}</div>
          <div className="text-white/70 text-xs">Overdue</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['Books','Borrowings'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t?'bg-white text-blue-600 shadow-sm':'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Books' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" placeholder="Search books..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? <p className="text-gray-400 col-span-3 py-8 text-center">Loading...</p>
              : books.map(b => (
              <div key={b.id} className="card card-hover">
                <div className="flex gap-3">
                  <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{ background: `hsl(${(b.title.charCodeAt(0)*7)%360},60%,90%)` }}>
                    📚
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-800 leading-tight">{b.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{b.author}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block">{b.category}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 text-xs">
                  <span className="text-gray-400">{b.location}</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-semibold ${b.available_copies > 0 ? 'text-green-600' : 'text-red-500'}`}>{b.available_copies}</span>
                    <span className="text-gray-400">/ {b.total_copies} available</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Borrowings' && (
        <div className="space-y-4">
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="borrowed">Borrowed</option>
            <option value="returned">Returned</option>
            <option value="overdue">Overdue</option>
          </select>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100"><tr>
                <th className="table-header">Book</th>
                <th className="table-header">Borrower</th>
                <th className="table-header">Borrow Date</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Status</th>
                <th className="table-header">Fine</th>
                <th className="table-header">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading...</td></tr>
                  : borrowings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-sm">{b.book_title}</td>
                    <td className="table-cell text-gray-500 text-xs capitalize">{b.borrower_type}</td>
                    <td className="table-cell text-gray-400 text-xs">{b.borrow_date ? format(parseISO(b.borrow_date),'MMM d, yyyy') : '—'}</td>
                    <td className="table-cell text-gray-400 text-xs">{b.due_date ? format(parseISO(b.due_date),'MMM d, yyyy') : '—'}</td>
                    <td className="table-cell"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[b.status]||''}`}>{b.status}</span></td>
                    <td className="table-cell text-sm">{parseFloat(b.fine_amount||0) > 0 ? <span className="text-red-500 font-semibold">GH₵{b.fine_amount}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell">
                      {b.status !== 'returned' && (
                        <button onClick={() => handleReturn(b.id)} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">Return</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100"><h2 className="font-display font-bold text-lg">Add New Book</h2></div>
            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Author</label>
                  <input className="input" value={form.author} onChange={e => setForm({...form, author: e.target.value})} />
                </div>
                <div>
                  <label className="label">ISBN</label>
                  <input className="input" value={form.isbn} onChange={e => setForm({...form, isbn: e.target.value})} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">Select</option>
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Copies</label>
                  <input type="number" className="input" min={1} value={form.total_copies} onChange={e => setForm({...form, total_copies: e.target.value})} />
                </div>
                <div>
                  <label className="label">Publisher</label>
                  <input className="input" value={form.publisher} onChange={e => setForm({...form, publisher: e.target.value})} />
                </div>
                <div>
                  <label className="label">Shelf Location</label>
                  <input className="input" placeholder="Shelf A1" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddBook(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Adding...' : 'Add Book'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
