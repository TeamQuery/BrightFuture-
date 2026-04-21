'use client';
import { useEffect, useState } from 'react';
import { getStudents, getClasses, createStudent, deleteStudent } from '@/lib/api';
import Link from 'next/link';
import { Plus, Search, Filter, Trash2, Eye, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { student_id: '', first_name: '', last_name: '', date_of_birth: '', gender: '', address: '', class_id: '', blood_group: '', medical_notes: '' };

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        getStudents({ search, class_id: classFilter, limit: 50 }),
        getClasses()
      ]);
      setStudents(sRes.data.students);
      setTotal(sRes.data.total);
      setClasses(cRes.data);
    } catch (e) { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, classFilter]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await createStudent(form);
      toast.success('Student added!');
      setShowModal(false); setForm(emptyForm); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add student'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try { await deleteStudent(id); toast.success('Student deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} students enrolled</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <UserPlus size={16} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Search by name or ID..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9" />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="input w-auto">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Student</th>
                <th className="table-header">ID</th>
                <th className="table-header">Class</th>
                <th className="table-header">Gender</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No students found</td></tr>
              ) : students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <img src={`https://ui-avatars.com/api/?name=${s.first_name}+${s.last_name}&background=${s.gender === 'Female' ? 'db2777' : '2563eb'}&color=fff&size=36`}
                        className="w-9 h-9 rounded-full" alt="" />
                      <div>
                        <div className="font-medium text-gray-800">{s.first_name} {s.last_name}</div>
                        <div className="text-xs text-gray-400">{s.date_of_birth ? new Date(s.date_of_birth).getFullYear() : '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-500">{s.student_id}</td>
                  <td className="table-cell">{s.class_name || '—'}</td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.gender === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.gender || '—'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Link href={`/students/${s.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye size={15} />
                      </Link>
                      <button onClick={() => handleDelete(s.id, `${s.first_name} ${s.last_name}`)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add student modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg">Add New Student</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Student ID *</label>
                  <input className="input" required placeholder="STU021" value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} />
                </div>
                <div>
                  <label className="label">Class</label>
                  <select className="input" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input" value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Medical Notes</label>
                <textarea className="input h-20 resize-none" value={form.medical_notes} onChange={e => setForm({...form, medical_notes: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
