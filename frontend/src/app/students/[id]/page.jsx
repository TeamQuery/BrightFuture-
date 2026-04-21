'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudent, getStudentGrades, getStudentAttendance, getStudentFees } from '@/lib/api';
import { ArrowLeft, User, BookOpen, ClipboardList, DollarSign, Heart, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

const tabs = ['Profile', 'Grades', 'Attendance', 'Fees'];

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [tab, setTab] = useState('Profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getStudent(id).then(r => setStudent(r.data)),
      getStudentGrades(id).then(r => setGrades(r.data)),
      getStudentAttendance(id).then(r => setAttendance(r.data)),
      getStudentFees(id).then(r => setFees(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!student) return <div className="text-center py-20 text-gray-400">Student not found</div>;

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;
  const avgGrade = grades.length ? Math.round(grades.reduce((s, g) => s + parseFloat(g.marks_obtained || 0), 0) / grades.length) : null;

  const statusBadge = { present: 'badge-present', absent: 'badge-absent', late: 'badge-late', excused: 'bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium' };
  const feeBadge = { paid: 'badge-paid', pending: 'badge-pending', partial: 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium', waived: 'bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium' };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">{student.first_name} {student.last_name}</h1>
          <p className="text-sm text-gray-500">{student.student_id} · {student.class_name}</p>
        </div>
      </div>

      {/* Header card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)' }}>
        <div className="flex items-start gap-5">
          <img src={`https://ui-avatars.com/api/?name=${student.first_name}+${student.last_name}&background=ffffff&color=2563eb&size=80`}
            className="w-20 h-20 rounded-2xl border-4 border-white/20" alt="" />
          <div className="flex-1 text-white">
            <h2 className="font-display font-bold text-xl">{student.first_name} {student.last_name}</h2>
            <p className="text-white/70 text-sm mt-0.5">{student.class_name} · {student.grade_level}</p>
            <div className="flex gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{attendanceRate}%</div>
                <div className="text-white/60 text-xs">Attendance</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold">{avgGrade ?? '—'}</div>
                <div className="text-white/60 text-xs">Avg Score</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold">{grades.length}</div>
                <div className="text-white/60 text-xs">Exams</div>
              </div>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${student.status === 'active' ? 'bg-green-400/20 text-green-200' : 'bg-gray-400/20 text-gray-200'}`}>
            {student.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'Profile' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><User size={16} className="text-blue-500" />Personal Info</h3>
            {[
              ['Date of Birth', student.date_of_birth ? format(parseISO(student.date_of_birth), 'MMMM d, yyyy') : '—'],
              ['Gender', student.gender || '—'],
              ['Blood Group', student.blood_group || '—'],
              ['Enrollment Date', student.enrollment_date ? format(parseISO(student.enrollment_date), 'MMM d, yyyy') : '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{l}</span>
                <span className="text-sm font-medium text-gray-800">{v}</span>
              </div>
            ))}
            {student.medical_notes && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs mb-1"><Heart size={12} />Medical Notes</div>
                <p className="text-xs text-red-700">{student.medical_notes}</p>
              </div>
            )}
          </div>
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Phone size={16} className="text-blue-500" />Contact & Parents</h3>
            {student.address && (
              <div className="flex gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span>{student.address}</span>
              </div>
            )}
            {(student.parents || []).map(p => (
              <div key={p.id} className="bg-blue-50 rounded-xl p-3">
                <div className="font-medium text-sm text-blue-800">{p.first_name} {p.last_name}</div>
                <div className="text-xs text-blue-600 mt-0.5">{p.relationship} · {p.phone}</div>
                <div className="text-xs text-blue-500">{p.occupation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grades tab */}
      {tab === 'Grades' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Exam Results</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="table-header">Exam</th>
              <th className="table-header">Subject</th>
              <th className="table-header">Type</th>
              <th className="table-header">Date</th>
              <th className="table-header">Score</th>
              <th className="table-header">Grade</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {grades.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No grades yet</td></tr>
                : grades.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-gray-800">{g.exam_name}</td>
                  <td className="table-cell text-gray-500">{g.subject_name}</td>
                  <td className="table-cell"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{g.exam_type}</span></td>
                  <td className="table-cell text-gray-400 text-xs">{g.exam_date ? format(parseISO(g.exam_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell font-semibold">{g.marks_obtained}/{g.total_marks}</td>
                  <td className="table-cell">
                    <span className={`font-bold text-sm ${g.grade_letter === 'A' ? 'text-green-600' : g.grade_letter === 'B' ? 'text-blue-600' : g.grade_letter === 'C' ? 'text-yellow-600' : 'text-red-500'}`}>
                      {g.grade_letter}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance tab */}
      {tab === 'Attendance' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Attendance Record</h3>
            <div className="flex gap-3 text-xs">
              <span className="text-green-600 font-medium">{presentCount} Present</span>
              <span className="text-red-500 font-medium">{attendance.filter(a=>a.status==='absent').length} Absent</span>
              <span className="text-yellow-600 font-medium">{attendance.filter(a=>a.status==='late').length} Late</span>
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="table-header">Date</th>
              <th className="table-header">Day</th>
              <th className="table-header">Status</th>
              <th className="table-header">Notes</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {attendance.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No records</td></tr>
                : attendance.slice(0,30).map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{format(parseISO(a.date), 'MMM d, yyyy')}</td>
                  <td className="table-cell text-gray-400">{format(parseISO(a.date), 'EEEE')}</td>
                  <td className="table-cell"><span className={statusBadge[a.status] || ''}>{a.status}</span></td>
                  <td className="table-cell text-gray-400 text-xs">{a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fees tab */}
      {tab === 'Fees' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Fee Payments</h3>
            <div className="text-sm font-semibold text-green-600">
              Total: GH₵ {fees.filter(f=>f.status==='paid').reduce((s,f)=>s+parseFloat(f.amount_paid||0),0).toLocaleString()}
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="table-header">Category</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Method</th>
              <th className="table-header">Date</th>
              <th className="table-header">Status</th>
              <th className="table-header">Reference</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {fees.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No records</td></tr>
                : fees.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{f.category_name}</td>
                  <td className="table-cell font-semibold text-gray-800">GH₵{Number(f.amount_paid).toLocaleString()}</td>
                  <td className="table-cell text-gray-500 capitalize text-xs">{f.payment_method?.replace('_',' ')}</td>
                  <td className="table-cell text-gray-400 text-xs">{f.payment_date ? format(parseISO(f.payment_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell"><span className={feeBadge[f.status] || ''}>{f.status}</span></td>
                  <td className="table-cell font-mono text-xs text-gray-400">{f.reference_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
