'use client';
import { useEffect, useState } from 'react';
import { getEvents, createEvent, deleteEvent } from '@/lib/api';
import { Plus, Calendar, Trash2 } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const eventTypes = ['academic','sports','cultural','holiday','exam','meeting','other'];
const typeColors = { exam:'bg-red-100 text-red-700 border-red-200', sports:'bg-green-100 text-green-700 border-green-200', cultural:'bg-purple-100 text-purple-700 border-purple-200', holiday:'bg-blue-100 text-blue-700 border-blue-200', meeting:'bg-orange-100 text-orange-700 border-orange-200', academic:'bg-teal-100 text-teal-700 border-teal-200', other:'bg-gray-100 text-gray-700 border-gray-200' };
const typeEmoji = { exam:'📝', sports:'⚽', cultural:'🎭', holiday:'🌴', meeting:'🤝', academic:'📚', other:'📌' };

const emptyForm = { title:'', description:'', event_date:'', end_date:'', event_type:'academic', target_audience:'all' };

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    getEvents().then(r => setEvents(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createEvent(form); toast.success('Event created!'); setShowModal(false); setForm(emptyForm); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try { await deleteEvent(id); toast.success('Event deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const upcoming = events.filter(e => !isPast(parseISO(e.event_date)) || isToday(parseISO(e.event_date)));
  const past = events.filter(e => isPast(parseISO(e.event_date)) && !isToday(parseISO(e.event_date)));

  const EventCard = ({ ev }) => (
    <div className={`card card-hover border ${typeColors[ev.event_type]?.split(' ').find(c=>c.startsWith('border')) || 'border-gray-100'}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{typeEmoji[ev.event_type] || '📌'}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{ev.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border mt-1 inline-block capitalize ${typeColors[ev.event_type] || ''}`}>{ev.event_type}</span>
            </div>
            {user?.role === 'admin' && (
              <button onClick={() => handleDelete(ev.id, ev.title)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          {ev.description && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{ev.description}</p>}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
            <Calendar size={11} />
            <span>{format(parseISO(ev.event_date), 'MMMM d, yyyy')}</span>
            {ev.end_date && ev.end_date !== ev.event_date && <span>– {format(parseISO(ev.end_date), 'MMMM d')}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">School calendar & announcements</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> New Event</button>
        )}
      </div>

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
              Upcoming ({upcoming.length})
            </h2>
            <div className="space-y-3">
              {upcoming.length === 0 ? <div className="card text-center text-gray-400 py-8 text-sm">No upcoming events</div>
                : upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full inline-block" />
              Past ({past.length})
            </h2>
            <div className="space-y-3 opacity-60">
              {past.slice(0,5).map(ev => <EventCard key={ev.id} ev={ev} />)}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="font-display font-bold text-lg">Create Event</h2></div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Event Title *</label>
                <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input h-20 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date *</label>
                  <input type="date" className="input" required value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Event Type</label>
                  <select className="input" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}>
                    {eventTypes.map(t => <option key={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Audience</label>
                  <select className="input" value={form.target_audience} onChange={e => setForm({...form, target_audience: e.target.value})}>
                    <option value="all">All</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                    <option value="parents">Parents</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Creating...' : 'Create Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
