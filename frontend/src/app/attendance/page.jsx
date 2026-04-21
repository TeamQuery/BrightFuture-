'use client';
import { useEffect, useState } from 'react';
import { getClasses, getStudents, getAttendance, markAttendance } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, AlertCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const statusOptions = [
  { value: 'present', label: 'Present', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'absent', label: 'Absent', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'late', label: 'Late', icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { value: 'excused', label: 'Excused', icon: AlertCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

export default function AttendancePage() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [existingMap, setExistingMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getClasses().then(r => setClasses(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    Promise.all([
      getStudents({ class_id: selectedClass, limit: 100 }),
      getAttendance({ class_id: selectedClass, date }),
    ]).then(([sRes, aRes]) => {
      const studs = sRes.data.students;
      setStudents(studs);
      const existing = {};
      aRes.data.forEach(a => { existing[a.student_id] = a.status; });
      setExistingMap(existing);
      const init = {};
      studs.forEach(s => { init[s.id] = existing[s.id] || 'present'; });
      setRecords(init);
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedClass, date]);

  const handleSave = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const payload = students.map(s => ({ student_id: s.id, class_id: selectedClass, date, status: records[s.id] || 'present' }));
      await markAttendance(payload);
      toast.success('Attendance saved!');
    } catch { toast.error('Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const counts = Object.values(records).reduce((acc, s) => { acc[s] = (acc[s]||0)+1; return acc; }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark and track student attendance</p>
        </div>
        {students.length > 0 && (
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <label className="label">Class</label>
          <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">Select class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} max={format(new Date(),'yyyy-MM-dd')} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      {students.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {statusOptions.map(({ value, label, icon: Icon, color }) => (
            <div key={value} className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
              <Icon size={20} />
              <div>
                <div className="text-xl font-bold">{counts[value] || 0}</div>
                <div className="text-xs font-medium">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance table */}
      {!selectedClass ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 text-sm">Select a class to mark attendance</p>
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-gray-400">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No students in this class</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Student</th>
                <th className="table-header">ID</th>
                {statusOptions.map(s => (
                  <th key={s.value} className="table-header text-center">
                    <button onClick={() => {
                      const all = {};
                      students.forEach(st => { all[st.id] = s.value; });
                      setRecords(all);
                    }} className={`text-xs px-2 py-1 rounded-lg border ${s.color} hover:opacity-80 transition-opacity`}>
                      All {s.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((s, idx) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell text-gray-400 text-xs">{idx+1}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <img src={`https://ui-avatars.com/api/?name=${s.first_name}+${s.last_name}&background=${s.gender==='Female'?'db2777':'2563eb'}&color=fff&size=32`}
                        className="w-8 h-8 rounded-full" alt="" />
                      <span className="font-medium text-sm text-gray-800">{s.first_name} {s.last_name}</span>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-400">{s.student_id}</td>
                  {statusOptions.map(({ value, icon: Icon, color }) => (
                    <td key={value} className="table-cell text-center">
                      <button
                        onClick={() => setRecords(prev => ({...prev, [s.id]: value}))}
                        className={`w-9 h-9 rounded-full border-2 flex items-center justify-center mx-auto transition-all ${records[s.id] === value ? color+' scale-110' : 'border-gray-200 text-gray-300 hover:border-gray-300'}`}>
                        <Icon size={16} />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
