'use client';
import { useEffect, useState } from 'react';
import { getStaff, createStaff, updateStaff } from '@/lib/api';
import { UserPlus, Search, Mail, Phone, Edit2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const roles = ['teacher','admin','librarian','accountant'];
const emptyForm = { name:'', email:'', role:'teacher', phone:'' };

const roleColors = { admin:'bg-purple-100 text-purple-700', teacher:'bg-blue-100 text-blue-700', librarian:'bg-orange-100 text-orange-700', accountant:'bg-green-100 text-green-700' };

export default function TeachersPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getStaff({ search }).then(r => setStaff(r.data)).catch(() => toast.error('Failed to load staff')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, email: s.email, role: s.role, phone: s.phone || '', is_active: s.is_active }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await updateStaff(editing.id, form); toast.success('Staff updated!'); }
      else { await createStaff(form); toast.success('Staff added! Default password: password123'); }
      setShowModal(false); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staff.length} staff members</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><UserPlus size={16} /> Add Staff</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? <div className="col-span-3 text-center py-12 text-gray-400">Loading...</div>
          : staff.map(s => (
          <div key={s.id} className="card card-hover">
            <div className="flex items-start gap-4">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=2563eb&color=fff&size=56`}
                className="w-14 h-14 rounded-2xl" alt="" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block capitalize ${roleColors[s.role] || 'bg-gray-100 text-gray-700'}`}>{s.role}</span>
                  </div>
                  <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={13} /></button>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-50 pt-3">
              <div className="flex items-center gap-2 text-xs text-gray-500"><Mail size={12} />{s.email}</div>
              {s.phone && <div className="flex items-center gap-2 text-xs text-gray-500"><Phone size={12} />{s.phone}</div>}
              {s.classes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.classes.map(c => <span key={c.name} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c.name}</span>)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-500">{s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg">{editing ? 'Edit Staff' : 'Add Staff Member'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    {roles.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                  <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                </div>
              )}
              {!editing && <p className="text-xs text-gray-400">Default password: <code className="bg-gray-100 px-1 rounded">password123</code></p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
