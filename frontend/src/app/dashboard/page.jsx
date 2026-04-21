'use client';
import { useEffect, useState } from 'react';
import { getDashboard } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, UserCheck, BookOpen, DollarSign, Library, Calendar, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2'];

function StatCard({ title, value, sub, icon: Icon, className, href }) {
  const content = (
    <div className={`${className} rounded-2xl p-5 text-white card-hover cursor-pointer`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-display font-bold mt-1">{value ?? '—'}</p>
          {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
        </div>
        <div className="bg-white/20 rounded-xl p-2.5"><Icon size={20} className="text-white" /></div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const stats = data?.stats || {};
  const attendanceWeek = (data?.attendanceWeek || []).map(d => ({
    date: format(parseISO(d.date), 'EEE'),
    Present: parseInt(d.present),
    Absent: parseInt(d.absent),
  }));

  const eventTypeColors = { exam:'bg-red-100 text-red-700', sports:'bg-green-100 text-green-700', cultural:'bg-purple-100 text-purple-700', holiday:'bg-blue-100 text-blue-700', meeting:'bg-orange-100 text-orange-700', academic:'bg-teal-100 text-teal-700', other:'bg-gray-100 text-gray-700' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Academic Year 2024/2025 · Term 2</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard href="/students" title="Total Students" value={stats.students?.total} sub={`${stats.students?.active} active`} icon={Users} className="stat-blue" />
        <StatCard href="/teachers" title="Teachers" value={stats.teachers?.total} sub="Active staff" icon={UserCheck} className="stat-purple" />
        <StatCard href="/finance" title="Fees Collected" value={`GH₵ ${Number(stats.feeCollected?.total || 0).toLocaleString()}`} sub="2024/2025" icon={DollarSign} className="stat-green" />
        <StatCard href="/library" title="Library Books" value={stats.books?.total} sub={`${stats.books?.available} available`} icon={Library} className="stat-orange" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard href="/attendance" title="Today Present" value={stats.attendanceToday?.present} sub={`of ${stats.attendanceToday?.total} total`} icon={CheckCircle2} className="stat-teal" />
        <StatCard href="/attendance" title="Today Absent" value={stats.attendanceToday?.absent} sub="students absent" icon={AlertTriangle} className="stat-pink" />
        <StatCard href="/classes" title="Classes" value={stats.classes?.total} sub="Active classes" icon={BookOpen} className="stat-blue" />
        <StatCard href="/library" title="Overdue Books" value={stats.overdueBorrowings?.total} sub="Need return" icon={Clock} className="stat-orange" />
      </div>

      {/* Charts + Events */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Weekly Attendance</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 school days</p>
            </div>
            <TrendingUp size={18} className="text-blue-500" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={attendanceWeek}>
              <defs>
                <linearGradient id="present" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="absent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Area type="monotone" dataKey="Present" stroke="#2563eb" strokeWidth={2} fill="url(#present)" />
              <Area type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} fill="url(#absent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fee by category pie */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-1">Fee Collection</h3>
          <p className="text-xs text-gray-400 mb-4">By category (GH₵)</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data?.feeByCategory || []} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>
                {(data?.feeByCategory || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `GH₵ ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {(data?.feeByCategory || []).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 truncate max-w-[100px]">{c.name}</span>
                </div>
                <span className="font-medium text-gray-800">GH₵{Number(c.total).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: events + recent students */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming events */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Upcoming Events</h3>
            <Link href="/events" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(data?.upcomingEvents || []).length === 0 && <p className="text-sm text-gray-400">No upcoming events</p>}
            {(data?.upcomingEvents || []).map(ev => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eventTypeColors[ev.event_type] || 'bg-gray-100 text-gray-700'}`}>{ev.event_type}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(ev.event_date), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent students */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Recent Students</h3>
            <Link href="/students" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(data?.recentStudents || []).map(s => (
              <Link key={s.id} href={`/students/${s.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                <img
                  src={`https://ui-avatars.com/api/?name=${s.first_name}+${s.last_name}&background=${s.gender === 'Female' ? 'db2777' : '2563eb'}&color=fff&size=36`}
                  className="w-9 h-9 rounded-full flex-shrink-0" alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.class_name} · {s.student_id}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
