'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard, UserCheck, GraduationCap,
  LogOut, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'parent', 'librarian', 'accountant'] },
  { href: '/teachers', label: 'Users & Audit', icon: UserCheck, roles: ['admin'] },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visible = navItems.filter(item => !user || item.roles.includes(user.role));

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100 w-64">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <div className="font-display font-bold text-sm text-gray-900">BrightFuture</div>
          <div className="text-xs text-gray-400">Primary School</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose}
              className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active ? 'nav-item-active' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
              <Icon size={17} className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mb-2">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=fff&size=36`}
              alt={user.name} className="w-9 h-9 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
              <div className="text-xs text-gray-400 capitalize">{user.role}</div>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
