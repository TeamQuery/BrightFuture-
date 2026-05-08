'use client';

import dynamic from 'next/dynamic';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  GraduationCap,
  Mail,
  Phone,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { extractApiError, getStaff, getStaffMember } from '@/lib/api';

const TeacherDetailModal = dynamic(() => import('./TeacherDetailModal'), {
  loading: () => null,
  ssr: false,
});

function InitialsAvatar({ name, photoUrl }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        className="w-12 h-12 rounded-full object-cover"
        alt={name || 'Teacher'}
      />
    );
  }

  const initials = (name || 'T')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
      {initials || 'T'}
    </div>
  );
}

function TeacherCard({ teacher, onSelect }) {
  const classes = teacher.classes || [];

  return (
    <button
      type="button"
      onClick={() => onSelect(teacher)}
      className="card card-hover text-left p-5 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <InitialsAvatar name={teacher.name} photoUrl={teacher.profile_photo_url} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-gray-900 truncate">{teacher.name}</h2>
          <p className="text-xs text-gray-500 mt-1">{teacher.employee_id || 'No employee ID'}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${teacher.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {teacher.is_active ? 'active' : 'inactive'}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-gray-400" />
          <span className="truncate">{teacher.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          <span>{teacher.phone || 'No phone recorded'}</span>
        </div>
        <div className="flex items-center gap-2">
          <BriefcaseBusiness size={14} className="text-gray-400" />
          <span>{teacher.specialization || teacher.qualification || 'No specialization recorded'}</span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <GraduationCap size={14} />
          Classes
        </div>
        {classes.length ? (
          <div className="flex flex-wrap gap-2">
            {classes.map((item) => (
              <span key={item.id || item.name} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                {item.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No classes assigned</p>
        )}
      </div>
    </button>
  );
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTeachers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getStaff({ role: 'teacher' });
      setTeachers(response.data || []);
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to load teachers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return teachers;
    }

    return teachers.filter((teacher) =>
      [
        teacher.name,
        teacher.email,
        teacher.employee_id,
        teacher.specialization,
        teacher.qualification,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch)),
    );
  }, [deferredSearch, teachers]);

  const assignedClassCount = useMemo(
    () => teachers.reduce((total, teacher) => total + (teacher.classes?.length || 0), 0),
    [teachers],
  );

  const openTeacher = async (teacher) => {
    setSelectedTeacher(teacher);
    setDetailLoading(true);

    try {
      const response = await getStaffMember(teacher.id);
      setSelectedTeacher(response.data);
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to load teacher details.'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Teacher directory backed by `/api/staff?role=teacher`</p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teachers..."
            className="input pl-9"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <UserCheck size={18} className="text-blue-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{teachers.length}</p>
          <p className="text-sm text-gray-500 mt-1">Teachers</p>
        </div>
        <div className="card">
          <GraduationCap size={18} className="text-emerald-700 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{assignedClassCount}</p>
          <p className="text-sm text-gray-500 mt-1">Assigned classes</p>
        </div>
        <div className="card">
          <Users size={18} className="text-purple-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{filteredTeachers.length}</p>
          <p className="text-sm text-gray-500 mt-1">Visible results</p>
        </div>
        <div className="card">
          <BriefcaseBusiness size={18} className="text-amber-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">
            {teachers.filter((teacher) => teacher.specialization).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Specializations</p>
        </div>
      </div>

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Loading teachers...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">No teachers matched your search.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} onSelect={openTeacher} />
          ))}
        </div>
      )}

      {selectedTeacher && (
        <TeacherDetailModal
          teacher={selectedTeacher}
          loading={detailLoading}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
}
