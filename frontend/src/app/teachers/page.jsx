'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Mail,
  ScrollText,
  Shield,
  Trash2,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RelativeTime from '@/components/RelativeTime';
import { extractApiError, getAuditLogs, getUsers, softDeleteUser } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);

    try {
      const [usersResponse, auditsResponse] = await Promise.all([
        getUsers({ limit: 100 }),
        getAuditLogs({ limit: 25 }),
      ]);

      setUsers(usersResponse.data.users || []);
      setAuditLogs(auditsResponse.data.auditLogs || []);
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) =>
      [user.name, user.email, user.role].some((value) =>
        value?.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [search, users]);

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Soft-delete ${user.name}? Their account will be deactivated and all sessions revoked.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);

    try {
      await softDeleteUser(user.id);
      toast.success(`${user.name} was soft-deleted.`);
      await load();
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to soft-delete user.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Users & Audit</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Admin view backed by `/api/users` and `/api/users/audit-logs`
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or role"
            className="input"
          />
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 card p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Users</h2>
              <p className="text-xs text-gray-500 mt-1">{filteredUsers.length} visible accounts</p>
            </div>
            <UserCheck size={18} className="text-blue-600" />
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-10 text-sm text-gray-400">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-400">No users matched your search.</div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {user.isActive ? 'active' : 'inactive'}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-700 capitalize">
                        {user.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                      <Mail size={12} />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Created <RelativeTime value={user.createdAt} />
                      {user.lastLoginAt
                        ? (
                          <>
                            {' '}• last login <RelativeTime value={user.lastLoginAt} />
                          </>
                        )
                        : ' • no successful login recorded yet'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    disabled={deletingId === user.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    {deletingId === user.id ? 'Removing...' : 'Soft delete'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Security Notes</h2>
                <p className="text-xs text-gray-500 mt-1">Current backend guarantees</p>
              </div>
              <Shield size={18} className="text-blue-600" />
            </div>
            <div className="space-y-3 mt-5">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Access tokens are short-lived and refresh tokens rotate in Redis-backed sessions.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Soft delete revokes live sessions and keeps an audit trail instead of hard-deleting records.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Rate limits apply per IP and per authenticated user across the backend.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Latest Audit Entries</h2>
                <p className="text-xs text-gray-500 mt-1">Recent security-sensitive actions</p>
              </div>
              <ScrollText size={18} className="text-amber-600" />
            </div>

            <div className="space-y-3 mt-5">
              {loading ? (
                <p className="text-sm text-gray-400">Loading audit log...</p>
              ) : auditLogs.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <AlertTriangle size={16} />
                  No audit events recorded yet.
                </div>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.action}</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {entry.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {entry.resourceType}
                      {entry.resourceId ? ` • ${entry.resourceId}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      <RelativeTime value={entry.createdAt} />
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
