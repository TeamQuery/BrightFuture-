'use client';
import { useEffect, useState } from 'react';
import { getExams, getGrades, getClasses, getSubjects, createExam, submitGrades } from '@/lib/api';
import { Plus, BookOpen, Award } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const examTypes = ['quiz','midterm','final','assignment','project'];
const terms = ['Term 1','Term 2','Term 3'];

export default function GradesPage() {
  const [tab, setTab] = useState('Exams');
  const [exams, setExams] = useState([]);
  const [grades, setGrades] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selExam, setSelExam] = useState('');
  const [selClass, setSelClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', subject_id:'', class_id:'', exam_date:'', total_marks:100, passing_marks:50, exam_type:'midterm', academic_year:'2024/2025', term:'Term 2' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getExams(), getClasses(), getSubjects()])
      .then(([e, c, s]) => { setExams(e.data); setClasses(c.data); setSubjects(s.data); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selExam || selClass) {
      getGrades({ exam_id: selExam || undefined, class_id: selClass || undefined })
        .then(r => setGrades(r.data)).catch(console.error);
    }
  }, [selExam, selClass]);

  const handleCreateExam = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createExam(form); toast.success('Exam created!'); setShowModal(false); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const typeBadge = { quiz:'bg-blue-100 text-blue-700', midterm:'bg-purple-100 text-purple-700', final:'bg-red-100 text-red-700', assignment:'bg-green-100 text-green-700', project:'bg-orange-100 text-orange-700' };
  const gradeLetter = (m, t) => { const p=(m/t)*100; return p>=80?'A':p>=70?'B':p>=60?'C':p>=50?'D':'F'; };
  const gradeColor = (l) => ({ A:'text-green-600', B:'text-blue-600', C:'text-yellow-600', D:'text-orange-600', F:'text-red-600' }[l] || '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Grades & Exams</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage examinations and student results</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> New Exam</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['Exams','Results'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Exams' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100"><tr>
              <th className="table-header">Exam Name</th>
              <th className="table-header">Subject</th>
              <th className="table-header">Class</th>
              <th className="table-header">Type</th>
              <th className="table-header">Date</th>
              <th className="table-header">Marks</th>
              <th className="table-header">Term</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
                : exams.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No exams yet</td></tr>
                : exams.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelExam(ex.id); setTab('Results'); }}>
                  <td className="table-cell font-medium text-gray-800">{ex.name}</td>
                  <td className="table-cell text-gray-500">{ex.subject_name}</td>
                  <td className="table-cell text-gray-500">{ex.class_name}</td>
                  <td className="table-cell"><span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeBadge[ex.exam_type]||'bg-gray-100 text-gray-600'}`}>{ex.exam_type}</span></td>
                  <td className="table-cell text-gray-400 text-xs">{ex.exam_date ? format(parseISO(ex.exam_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell"><span className="font-semibold">{ex.total_marks}</span> <span className="text-gray-400 text-xs">(pass: {ex.passing_marks})</span></td>
                  <td className="table-cell text-gray-500 text-xs">{ex.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Results' && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <select className="input w-auto" value={selExam} onChange={e => { setSelExam(e.target.value); setSelClass(''); }}>
              <option value="">Filter by exam...</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="input w-auto" value={selClass} onChange={e => { setSelClass(e.target.value); setSelExam(''); }}>
              <option value="">Filter by class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100"><tr>
                <th className="table-header">Student</th>
                <th className="table-header">Exam</th>
                <th className="table-header">Subject</th>
                <th className="table-header">Score</th>
                <th className="table-header">%</th>
                <th className="table-header">Grade</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {grades.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Select an exam or class to view results</td></tr>
                  : grades.map(g => {
                    const pct = Math.round((g.marks_obtained / g.total_marks) * 100);
                    const letter = g.grade_letter || gradeLetter(g.marks_obtained, g.total_marks);
                    return (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{g.first_name} {g.last_name} <span className="text-xs text-gray-400 font-mono">({g.sid})</span></td>
                        <td className="table-cell text-gray-500 text-sm">{g.exam_name}</td>
                        <td className="table-cell text-gray-400 text-xs">{g.subject_name}</td>
                        <td className="table-cell font-semibold">{g.marks_obtained}/{g.total_marks}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-[60px]">
                              <div className="h-full bg-blue-500 rounded-full" style={{width:`${pct}%`}} />
                            </div>
                            <span className="text-xs text-gray-500">{pct}%</span>
                          </div>
                        </td>
                        <td className="table-cell"><span className={`font-bold text-lg ${gradeColor(letter)}`}>{letter}</span></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="font-display font-bold text-lg">Create New Exam</h2></div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              <div>
                <label className="label">Exam Name *</label>
                <input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Subject *</label>
                  <select className="input" required value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})}>
                    <option value="">Select</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Class *</label>
                  <select className="input" required value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                    <option value="">Select</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Exam Type</label>
                  <select className="input" value={form.exam_type} onChange={e => setForm({...form, exam_type: e.target.value})}>
                    {examTypes.map(t => <option key={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" required value={form.exam_date} onChange={e => setForm({...form, exam_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Total Marks</label>
                  <input type="number" className="input" value={form.total_marks} onChange={e => setForm({...form, total_marks: e.target.value})} />
                </div>
                <div>
                  <label className="label">Passing Marks</label>
                  <input type="number" className="input" value={form.passing_marks} onChange={e => setForm({...form, passing_marks: e.target.value})} />
                </div>
                <div>
                  <label className="label">Term</label>
                  <select className="input" value={form.term} onChange={e => setForm({...form, term: e.target.value})}>
                    {terms.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Academic Year</label>
                  <input className="input" value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Creating...' : 'Create Exam'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
