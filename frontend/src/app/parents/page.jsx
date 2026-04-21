'use client';
import { useEffect, useState } from 'react';
import { getParents } from '@/lib/api';
import { Search, Phone, Mail, Users } from 'lucide-react';

export default function ParentsPage() {
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParents().then(r => setParents(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = parents.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email} ${p.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Parents & Guardians</h1>
        <p className="text-sm text-gray-500 mt-0.5">{parents.length} registered parents</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" placeholder="Search parents..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card card-hover">
              <div className="flex items-start gap-4">
                <img src={`https://ui-avatars.com/api/?name=${p.first_name}+${p.last_name}&background=7c3aed&color=fff&size=48`}
                  className="w-12 h-12 rounded-2xl" alt="" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{p.first_name} {p.last_name}</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{p.relationship}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-50 pt-3">
                {p.email && <div className="flex items-center gap-2 text-xs text-gray-500"><Mail size={12} />{p.email}</div>}
                {p.phone && <div className="flex items-center gap-2 text-xs text-gray-500"><Phone size={12} />{p.phone}</div>}
                {p.occupation && <div className="text-xs text-gray-400">{p.occupation}</div>}
                <div className="flex items-center gap-1 mt-2">
                  <Users size={12} className="text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">{p.children_count} child{p.children_count !== 1 ? 'ren' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
