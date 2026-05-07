'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Database,
  ShieldCheck,
  ScrollText,
  Server,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import RelativeTime from '@/components/RelativeTime';
import { extractApiError, getAuditLogs, getSystemHealth, getUsers } from '@/lib/api';

function StatCard({ icon: Icon, label, value, accentClass, helper }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-2xl font-display font-bold text-gray-900 mt-2">{value}</p>
          {helper ? <p className="text-xs text-gray-500 mt-2">{helper}</p> : null}
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${accentClass}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function HealthCard({ title, check, icon: Icon }) {
  const statusClass =
    check?.status === 'ok'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700';

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {check?.latencyMs != null ? `${check.latencyMs} ms latency` : 'No latency available'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
          <Icon size={18} />
        </div>
      </div>
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mt-4 ${statusClass}`}>
        <span className="w-2 h-2 rounded-full bg-current" />
        {check?.status === 'ok' ? 'Healthy' : 'Degraded'}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    async function load() {
      setLoading(true);

      try {
        const requests = [getSystemHealth()];

        if (user.role === 'admin') {
          requests.push(getUsers({ limit: 100 }), getAuditLogs({ limit: 8 }));
        }

        const [healthResponse, usersResponse, auditResponse] = await Promise.all(requests);

        if (!isMounted) {
          return;
        }

        setHealth(healthResponse.data);
        setUsers(usersResponse?.data?.users || []);
        setAuditLogs(auditResponse?.data?.auditLogs || []);
      } catch (error) {
        if (isMounted) {
          toast.error(extractApiError(error, 'Failed to load dashboard.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const roleSummary = useMemo(() => {
    return users.reduce((summary, member) => {
      summary[member.role] = (summary[member.role] || 0) + 1;
      return summary;
    }, {});
  }, [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Workspace Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ShieldCheck}
          label="Signed In As"
          value={user?.role?.toUpperCase() || 'UNKNOWN'}
          helper={user?.email}
          accentClass="bg-blue-600"
        />
        <StatCard
          icon={Activity}
          label="API Status"
          value={health?.status === 'ok' ? 'Healthy' : 'Degraded'}
          helper={health?.timestamp ? <RelativeTime value={health.timestamp} prefix="Checked " /> : null}
          accentClass="bg-emerald-600"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={user?.role === 'admin' ? users.length : 1}
          helper={user?.role === 'admin' ? 'Visible via admin API' : 'Your current authenticated account'}
          accentClass="bg-slate-800"
        />
        <StatCard
          icon={ScrollText}
          label="Recent Audits"
          value={user?.role === 'admin' ? auditLogs.length : 'Restricted'}
          helper={user?.role === 'admin' ? 'Latest audit trail entries' : 'Audit log visibility is admin-only'}
          accentClass="bg-amber-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <HealthCard title="PostgreSQL" check={health?.checks?.database} icon={Database} />
        <HealthCard title="Redis" check={health?.checks?.redis} icon={Server} />
      </div>

      {user?.role === 'admin' && (
        <div className="grid xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Role Distribution</h2>
                <p className="text-xs text-gray-500 mt-1">Derived from `/api/users`</p>
              </div>
              <Users size={18} className="text-blue-600" />
            </div>

            <div className="space-y-3 mt-5">
              {Object.entries(roleSummary).length === 0 ? (
                <p className="text-sm text-gray-400">No users available.</p>
              ) : (
                Object.entries(roleSummary).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium capitalize text-slate-700">{role}</span>
                    <span className="text-sm font-bold text-slate-900">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="xl:col-span-3 card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Recent Audit Activity</h2>
                <p className="text-xs text-gray-500 mt-1">Latest security-relevant backend events</p>
              </div>
              <ScrollText size={18} className="text-amber-600" />
            </div>

            <div className="space-y-3 mt-5">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400">No audit events found yet.</p>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.action}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {entry.resourceType}
                          {entry.resourceId ? ` • ${entry.resourceId}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {entry.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      <RelativeTime value={entry.createdAt} />
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
