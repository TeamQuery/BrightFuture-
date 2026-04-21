'use client';
import { useEffect, useState } from 'react';
import { getClasses, getStaff, createClass } from '@/lib/api';
import { Plus, Users, Home, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { name:'', grade_level:'', section:'', capacity:30, room:'', teacher_id:'', academic_year:'2024/2025' };

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getClasses(), getStaff({ role:'teacher' })])
      .then(([c, t]) => { setClasses(c.data); setTeachers(t.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createClass(form); toast.success('Class created!'); setShowModal(false); setForm(emptyForm); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const gradeLevels = ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'];
  const capacityColor = (used, cap) => {
    const pct = (used/cap)*100;
    return pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{classes.length} classes · Academic Year 2024/2025</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> New Class</button>
      </div>

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map(cls => {
            const used = parseInt(cls.student_count || 0);
            const cap = cls.capacity;
            const pct = Math.min(Math.round((used/cap)*100), 100);
            return (
              <div key={cls.id} className="card card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-gray-900">{cls.name}</h3>
                    <p className="text-sm text-gray-500">{cls.grade_level} · Section {cls.section}</p>
                  </div>
                  <div className="bg-blue-50 text-blue-700 rounded-xl px-3 py-1 text-sm font-bold">{cls.room}</div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <UserCheck size={14} className="text-blue-500" />
                    <span>{cls.teacher_name || 'No teacher assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users size={14} className="text-purple-500" />
                    <span>{used} / {cap} students</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Capacity</span><span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${capacityColor(used, cap)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg">Create New Class</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Class Name *</label>
                  <input className="input" required placeholder="Grade 1A" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Grade Level *</label>
                  <select className="input" required value={form.grade_level} onChange={e => setForm({...form, grade_level: e.target.value})}>
                    <option value="">Select</option>
                    {gradeLevels.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Section</label>
                  <input className="input" placeholder="A" value={form.section} onChange={e => setForm({...form, section: e.target.value})} />
                </div>
                <div>
                  <label className="label">Room</label>
                  <input className="input" placeholder="Room 101" value={form.room} onChange={e => setForm({...form, room: e.target.value})} />
                </div>
                <div>
                  <label className="label">Capacity</label>
                  <input type="number" className="input" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
                </div>
                <div>
                  <label className="label">Academic Year</label>
                  <input className="input" value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Class Teacher</label>
                <select className="input" value={form.teacher_id} onChange={e => setForm({...form, teacher_id: e.target.value})}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Creating...' : 'Create Class'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
