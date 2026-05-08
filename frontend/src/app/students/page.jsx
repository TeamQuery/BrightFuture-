'use client';
import { useEffect, useMemo, useState } from 'react';
import { getStudents, getStudent, getClasses, createStudent, deleteStudent, updateStudentPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Search, Trash2, Eye, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { student_id: '', first_name: '', last_name: '', date_of_birth: '', gender: '', address: '', class_id: '', blood_group: '', medical_notes: '' };
const MAX_PHOTO_BYTES = 750 * 1024;

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function label(value) {
  if (!value) return 'Not set';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function Field({ label: fieldLabel, value }) {
  return (
    <div>
      <p className="label">{fieldLabel}</p>
      <p className="text-sm text-gray-800 mt-1">{value || 'Not set'}</p>
    </div>
  );
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function IdentityCard({ name, email, id, photoUrl, saving, canManage, onPhotoSelected, onPhotoRemove }) {
  const imageSrc = photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Student')}&background=2563eb&color=fff&size=96`;

  return (
    <div className="flex flex-col items-center text-center py-4">
      <img
        src={imageSrc}
        className="w-20 h-20 rounded-full shadow-sm"
        alt={name || 'Student'}
      />
      <h3 className="font-display font-bold text-xl text-gray-900 mt-4">{name || 'Not set'}</h3>
      <p className="text-sm text-gray-500 mt-1 break-all">{email || 'No email recorded'}</p>
      <p className="text-xs font-mono text-gray-400 mt-2">{id || 'No student ID'}</p>
      {canManage && (
        <div className="flex items-center gap-2 mt-4">
          <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer">
            {saving ? 'Uploading...' : 'Upload photo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={saving}
              onChange={onPhotoSelected}
            />
          </label>
          {photoUrl && (
            <button
              type="button"
              onClick={onPhotoRemove}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        )}
    </div>
  );
}

const studentTabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'details', label: 'Details' },
  { id: 'parents', label: 'Parents' },
  { id: 'notes', label: 'Notes' },
];

function StudentDetailModal({ student, loading, canManage, onClose }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [photoUrl, setPhotoUrl] = useState(student.profile_photo_url || '');
  const [photoSaving, setPhotoSaving] = useState(false);
  const parents = student.parents || [];
  const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim();

  const savePhoto = async (nextPhotoUrl) => {
    setPhotoSaving(true);

    try {
      await updateStudentPhoto(student.id, nextPhotoUrl);
      setPhotoUrl(nextPhotoUrl || '');
      toast.success(nextPhotoUrl ? 'Student photo updated.' : 'Student photo removed.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update student photo.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Choose an image under 750 KB.');
      return;
    }

    try {
      const nextPhotoUrl = await readPhoto(file);
      await savePhoto(nextPhotoUrl);
    } catch {
      toast.error('Failed to read photo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-display font-bold text-lg">{student.first_name} {student.last_name}</h2>
          <p className="text-sm text-gray-500 mt-1">{student.student_id || 'No student ID'} / {student.class_name || 'No class assigned'}</p>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
            {studentTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-gray-400">Loading student details...</div>
          ) : (
            <>
              {activeTab === 'profile' && (
                <IdentityCard
                  name={studentName}
                  email={student.email}
                  id={student.student_id}
                  photoUrl={photoUrl}
                  saving={photoSaving}
                  canManage={canManage}
                  onPhotoSelected={handlePhotoSelected}
                  onPhotoRemove={() => savePhoto(null)}
                />
              )}

              {activeTab === 'details' && (
                <section className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Student Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Class" value={student.class_name} />
                    <Field label="Status" value={label(student.status)} />
                    <Field label="Grade Level" value={student.grade_level ? `Grade ${student.grade_level}` : null} />
                    <Field label="Blood Group" value={student.blood_group} />
                    <Field label="Date of Birth" value={formatDate(student.date_of_birth)} />
                    <Field label="Gender" value={label(student.gender)} />
                    <Field label="Enrollment Date" value={formatDate(student.enrollment_date)} />
                    <Field label="Emergency Contact" value={student.emergency_contact} />
                  </div>
                </section>
              )}

              {activeTab === 'parents' && (
                <section className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Parents / Guardians</h3>
                  {parents.length ? (
                    <div className="space-y-3">
                      {parents.map((parent) => (
                        <div key={parent.id} className="rounded-xl bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900">{parent.first_name} {parent.last_name}</p>
                            <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">
                              {label(parent.student_relationship || parent.relationship)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <Field label="Email" value={parent.email} />
                            <Field label="Phone" value={parent.phone} />
                            <Field label="Occupation" value={parent.occupation} />
                            <Field label="Primary Contact" value={parent.student_primary_contact || parent.is_primary ? 'Yes' : 'No'} />
                          </div>
                          <div className="mt-4">
                            <Field label="Address" value={parent.address} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No parent or guardian linked to this student.</p>
                  )}
                </section>
              )}

              {activeTab === 'notes' && (
                <section className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Notes & Address</h3>
                  <Field label="Address" value={student.address} />
                  <Field label="Medical Notes" value={student.medical_info || student.medical_notes} />
                </section>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const canManageStudents = user?.role === 'admin';
  const pageTitle = user?.role === 'parent' ? 'My Children' : user?.role === 'teacher' ? 'My Class Students' : 'Students';

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
    if (!canManageStudents) return;
    e.preventDefault(); setSaving(true);
    try {
      await createStudent(form);
      toast.success('Student added!');
      setShowModal(false); setForm(emptyForm); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add student'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!canManageStudents) return;
    if (!confirm(`Delete ${name}?`)) return;
    try { await deleteStudent(id); toast.success('Student deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const openStudent = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);

    try {
      const response = await getStudent(student.id);
      setSelectedStudent(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load student details');
    } finally {
      setDetailLoading(false);
    }
  };

  const groupedStudents = useMemo(() => {
    const groups = new Map();

    for (const student of students) {
      const key = student.class_name || 'No Class Assigned';

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(student);
    }

    return [...groups.entries()];
  }, [students]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} visible students</p>
        </div>
        {canManageStudents && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus size={16} /> Add Student
          </button>
        )}
      </div>

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

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Loading...</div>
      ) : students.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">No students found</div>
      ) : (
        <div className="space-y-5">
          {groupedStudents.map(([className, group]) => (
            <div key={className} className="card p-0 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">{className}</h2>
                <span className="text-xs text-gray-500">{group.length} students</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="table-header">Student</th>
                      <th className="table-header">ID</th>
                      <th className="table-header">Gender</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.map(s => {
                      const gender = String(s.gender || '').toLowerCase();

                      return (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <img src={s.profile_photo_url || `https://ui-avatars.com/api/?name=${s.first_name}+${s.last_name}&background=${gender === 'female' ? 'db2777' : '2563eb'}&color=fff&size=36`}
                                className="w-9 h-9 rounded-full" alt="" />
                              <div>
                                <div className="font-medium text-gray-800">{s.first_name} {s.last_name}</div>
                                <div className="text-xs text-gray-400">{s.date_of_birth ? new Date(s.date_of_birth).getFullYear() : '-'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell font-mono text-xs text-gray-500">{s.student_id}</td>
                          <td className="table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                              {label(s.gender)}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => openStudent(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Eye size={15} />
                              </button>
                              {canManageStudents && (
                                <button onClick={() => handleDelete(s.id, `${s.first_name} ${s.last_name}`)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  <label className="label">Date of Birth *</label>
                  <input type="date" className="input" required value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="">Select</option>
                    <option value="male">Male</option><option value="female">Female</option>
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

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          loading={detailLoading}
          canManage={canManageStudents}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
