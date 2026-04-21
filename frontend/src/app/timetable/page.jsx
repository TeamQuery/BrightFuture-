'use client';
import { useEffect, useState } from 'react';
import { getClasses, getTimetable } from '@/lib/api';
import { Clock } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const subjectColors = ['bg-blue-100 text-blue-800 border-blue-200','bg-purple-100 text-purple-800 border-purple-200','bg-green-100 text-green-800 border-green-200','bg-orange-100 text-orange-800 border-orange-200','bg-pink-100 text-pink-800 border-pink-200','bg-teal-100 text-teal-800 border-teal-200','bg-yellow-100 text-yellow-800 border-yellow-200','bg-red-100 text-red-800 border-red-200'];

export default function TimetablePage() {
  const [classes, setClasses] = useState([]);
  const [selClass, setSelClass] = useState('');
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const subjectColorMap = {};
  let colorIdx = 0;

  useEffect(() => { getClasses().then(r => setClasses(r.data)).catch(console.error); }, []);

  useEffect(() => {
    if (!selClass) return;
    setLoading(true);
    getTimetable({ class_id: selClass }).then(r => setTimetable(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [selClass]);

  const getSubjectColor = (name) => {
    if (!subjectColorMap[name]) { subjectColorMap[name] = subjectColors[colorIdx++ % subjectColors.length]; }
    return subjectColorMap[name];
  };

  const byDay = DAYS.reduce((acc, d) => { acc[d] = timetable.filter(t => t.day_of_week === d); return acc; }, {});
  const fmt = (t) => { if (!t) return ''; const [h,m] = t.split(':'); const hr = parseInt(h); return `${hr>12?hr-12:hr}:${m} ${hr>=12?'PM':'AM'}`; };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Timetable</h1>
        <p className="text-sm text-gray-500 mt-0.5">Weekly class schedule</p>
      </div>

      <div className="max-w-xs">
        <label className="label">Select Class</label>
        <select className="input" value={selClass} onChange={e => setSelClass(e.target.value)}>
          <option value="">Choose a class...</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selClass ? (
        <div className="card text-center py-20">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-400">Select a class to view its timetable</p>
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-gray-400">Loading timetable...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {DAYS.map(day => (
            <div key={day} className="space-y-2">
              <div className="card p-3 text-center" style={{ background: 'linear-gradient(135deg, #1e3a8a, #7c3aed)' }}>
                <h3 className="font-display font-bold text-sm text-white">{day}</h3>
                <p className="text-white/60 text-xs">{byDay[day].length} periods</p>
              </div>
              {byDay[day].length === 0 ? (
                <div className="card p-4 text-center text-gray-300 text-xs border-dashed">No classes</div>
              ) : byDay[day].map(slot => (
                <div key={slot.id} className={`card p-3 border ${getSubjectColor(slot.subject_name)}`}>
                  <div className="font-semibold text-xs mb-1">{slot.subject_name}</div>
                  <div className="flex items-center gap-1 text-xs opacity-70">
                    <Clock size={10} />{fmt(slot.start_time)} – {fmt(slot.end_time)}
                  </div>
                  {slot.teacher_name && <div className="text-xs opacity-60 mt-1 truncate">{slot.teacher_name}</div>}
                  {slot.room && <div className="text-xs opacity-50">{slot.room}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
