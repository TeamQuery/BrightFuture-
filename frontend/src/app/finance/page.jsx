'use client';
import { useEffect, useState } from 'react';
import { getFeePayments, getFeeCategories, getStudents, createFeePayment, getFinanceSummary } from '@/lib/api';
import { Plus, DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const payMethods = ['cash','bank_transfer','mobile_money','card'];
const emptyForm = { student_id:'', category_id:'', amount_paid:'', payment_method:'cash', reference_number:'', academic_year:'2024/2025', term:'Term 2', status:'paid', notes:'' };

export default function FinancePage() {
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      getFeePayments({ status: statusFilter || undefined }),
      getFeeCategories(),
      getStudents({ limit: 200 }),
      getFinanceSummary({ academic_year: '2024/2025' }),
    ]).then(([p, c, s, sum]) => {
      setPayments(p.data); setCategories(c.data);
      setStudents(s.data.students); setSummary(sum.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createFeePayment(form); toast.success('Payment recorded!'); setShowModal(false); setForm(emptyForm); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const catChartData = categories.map(c => ({
    name: c.name.replace(' Fee',''),
    amount: parseFloat(c.amount),
  }));

  const statusBadge = { paid:'badge-paid', pending:'badge-pending', partial:'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium', waived:'bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fee management & payment records</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Record Payment</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card stat-green text-white rounded-2xl">
            <DollarSign size={20} className="mb-2 opacity-80" />
            <div className="text-2xl font-bold">GH₵{Number(summary.total_collected||0).toLocaleString()}</div>
            <div className="text-white/70 text-xs mt-1">Total Collected</div>
          </div>
          <div className="card stat-orange text-white rounded-2xl">
            <Clock size={20} className="mb-2 opacity-80" />
            <div className="text-2xl font-bold">GH₵{Number(summary.total_pending||0).toLocaleString()}</div>
            <div className="text-white/70 text-xs mt-1">Pending Amount</div>
          </div>
          <div className="card stat-blue text-white rounded-2xl">
            <CheckCircle size={20} className="mb-2 opacity-80" />
            <div className="text-2xl font-bold">{summary.paid_count}</div>
            <div className="text-white/70 text-xs mt-1">Paid Transactions</div>
          </div>
          <div className="card stat-purple text-white rounded-2xl">
            <TrendingUp size={20} className="mb-2 opacity-80" />
            <div className="text-2xl font-bold">{summary.students_paid}</div>
            <div className="text-white/70 text-xs mt-1">Students Paid</div>
          </div>
        </div>
      )}

      {/* Chart + payments */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Fee Structure</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catChartData} layout="vertical">
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94a3b8'}} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#64748b'}} width={80} />
              <Tooltip formatter={v => `GH₵${v}`} contentStyle={{borderRadius:8,fontSize:11}} />
              <Bar dataKey="amount" fill="#2563eb" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <h3 className="font-semibold text-gray-800 flex-1">Payment Records</h3>
            <select className="input w-auto text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0"><tr>
                <th className="table-header">Student</th>
                <th className="table-header">Category</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Method</th>
                <th className="table-header">Date</th>
                <th className="table-header">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading...</td></tr>
                  : payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-sm">{p.first_name} {p.last_name}</td>
                    <td className="table-cell text-gray-500 text-xs">{p.category_name}</td>
                    <td className="table-cell font-semibold text-sm">GH₵{Number(p.amount_paid).toLocaleString()}</td>
                    <td className="table-cell text-gray-400 text-xs capitalize">{p.payment_method?.replace('_',' ')}</td>
                    <td className="table-cell text-gray-400 text-xs">{p.payment_date ? format(parseISO(p.payment_date),'MMM d') : '—'}</td>
                    <td className="table-cell"><span className={statusBadge[p.status]||''}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="font-display font-bold text-lg">Record Fee Payment</h2></div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Student *</label>
                  <select className="input" required value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}>
                    <option value="">Select student</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fee Category *</label>
                  <select className="input" required value={form.category_id} onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setForm({...form, category_id: e.target.value, amount_paid: cat?.amount || ''});
                  }}>
                    <option value="">Select</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} (GH₵{c.amount})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount (GH₵) *</label>
                  <input type="number" className="input" required value={form.amount_paid} onChange={e => setForm({...form, amount_paid: e.target.value})} />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    {payMethods.map(m => <option key={m} value={m} className="capitalize">{m.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partial</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Reference Number</label>
                  <input className="input" placeholder="REF-XXXXX" value={form.reference_number} onChange={e => setForm({...form, reference_number: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
