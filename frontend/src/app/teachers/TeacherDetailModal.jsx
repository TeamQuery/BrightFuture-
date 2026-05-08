'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { extractApiError, updateStaffPhoto } from '@/lib/api';

const moneyFormatterCache = new Map();
const MAX_PHOTO_BYTES = 750 * 1024;

function getMoneyFormatter(currency = 'GHS') {
  if (!moneyFormatterCache.has(currency)) {
    moneyFormatterCache.set(
      currency,
      new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }),
    );
  }

  return moneyFormatterCache.get(currency);
}

function formatMoney(value, currency = 'GHS') {
  return getMoneyFormatter(currency).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Field({ label, value }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm text-gray-800 mt-1">{value || 'Not set'}</p>
    </div>
  );
}

function Section({ title, children, divided = true }) {
  return (
    <section className={`space-y-4 ${divided ? 'border-t border-gray-100 pt-4' : ''}`}>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function IdentityCard({ name, email, id, photoUrl, saving, onPhotoSelected, onPhotoRemove }) {
  const imageSrc = photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Teacher')}&background=2563eb&color=fff&size=96`;

  return (
    <div className="flex flex-col items-center text-center py-4">
      <img
        src={imageSrc}
        className="w-20 h-20 rounded-full shadow-sm"
        alt={name || 'Teacher'}
      />
      <h3 className="font-display font-bold text-xl text-gray-900 mt-4">{name || 'Not set'}</h3>
      <p className="text-sm text-gray-500 mt-1 break-all">{email || 'No email recorded'}</p>
      <p className="text-xs font-mono text-gray-400 mt-2">{id || 'No employee ID'}</p>
      <div className="flex items-center gap-2 mt-4">
        <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer">
          {saving ? 'Uploading...' : 'Upload photo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={saving}
            onChange={onPhotoSelected}
          />
        </label>
        {photoUrl && (
          <button
            type="button"
            onClick={onPhotoRemove}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

const tabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'details', label: 'Details' },
  { id: 'salary', label: 'Salary' },
  { id: 'payments', label: 'Payments' },
];

export default function TeacherDetailModal({ teacher, loading, onClose }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [photoUrl, setPhotoUrl] = useState(teacher.profile_photo_url || '');
  const [photoSaving, setPhotoSaving] = useState(false);
  const currentSalary = teacher?.compensation?.currentSalary;
  const salaryPayments = teacher?.compensation?.payments || [];
  const salaryStructures = teacher?.compensation?.salaries || [];
  const currency = currentSalary?.currency || 'GHS';

  const savePhoto = async (nextPhotoUrl) => {
    setPhotoSaving(true);

    try {
      await updateStaffPhoto(teacher.id, nextPhotoUrl);
      setPhotoUrl(nextPhotoUrl || '');
      toast.success(nextPhotoUrl ? 'Teacher photo updated.' : 'Teacher photo removed.');
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to update teacher photo.'));
    } finally {
      setPhotoSaving(false);
    }
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Choose an image under 750 KB.');
      return;
    }

    try {
      const nextPhotoUrl = await readPhoto(file);
      await savePhoto(nextPhotoUrl);
    } catch {
      toast.error('Failed to read photo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-display font-bold text-lg">{teacher.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {teacher.employee_id || 'No employee ID'} / {teacher.email}
          </p>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-gray-400">Loading teacher details...</div>
          ) : (
            <>
              {activeTab === 'profile' && (
                <IdentityCard
                  name={teacher.name}
                  email={teacher.email}
                  id={teacher.employee_id}
                  photoUrl={photoUrl}
                  saving={photoSaving}
                  onPhotoSelected={handlePhotoSelected}
                  onPhotoRemove={() => savePhoto(null)}
                />
              )}

              {activeTab === 'details' && (
                <Section title="Teacher Information" divided={false}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone" value={teacher.phone} />
                    <Field label="Gender" value={teacher.gender} />
                    <Field label="Date of Birth" value={formatDate(teacher.date_of_birth)} />
                    <Field label="Hire Date" value={formatDate(teacher.hire_date)} />
                    <Field label="Qualification" value={teacher.qualification} />
                    <Field label="Specialization" value={teacher.specialization} />
                  </div>
                  <Field label="Address" value={teacher.address} />
                </Section>
              )}

              {activeTab === 'salary' && (
                <div className="space-y-4">
                  <Section title="Current Salary" divided={false}>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Base Salary" value={currentSalary ? formatMoney(currentSalary.base_salary, currency) : null} />
                      <Field label="Allowances" value={currentSalary ? formatMoney(currentSalary.allowances, currency) : null} />
                      <Field label="Deductions" value={currentSalary ? formatMoney(currentSalary.deductions, currency) : null} />
                      <Field label="Payment Frequency" value={currentSalary?.payment_frequency} />
                      <Field label="Effective Date" value={formatDate(currentSalary?.effective_date)} />
                      <Field label="Currency" value={currentSalary?.currency} />
                    </div>
                  </Section>

                  <Section title="Salary Structures">
                    <div className="space-y-3">
                      {salaryStructures.length ? (
                        salaryStructures.map((salary) => (
                          <div key={salary.id} className="rounded-xl bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatMoney(salary.base_salary, salary.currency)}
                              </p>
                              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${salary.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {salary.is_active ? 'active' : 'inactive'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Allowance {formatMoney(salary.allowances, salary.currency)} / Deduction {formatMoney(salary.deductions, salary.currency)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Effective {formatDate(salary.effective_date)} / {salary.payment_frequency}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">No salary structure recorded.</p>
                      )}
                    </div>
                  </Section>
                </div>
              )}

              {activeTab === 'payments' && (
                <Section title="Salary Payments" divided={false}>
                  <div className="space-y-3">
                    {salaryPayments.length ? (
                      salaryPayments.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-gray-100 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatMoney(payment.net_amount, currency)}
                            </p>
                            <span className="text-xs text-gray-500">{formatDate(payment.payment_date)}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Gross {formatMoney(payment.gross_amount, currency)} / Extra allowance {formatMoney(payment.additional_allowances, currency)} / Extra deduction {formatMoney(payment.additional_deductions, currency)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(payment.payment_period_start)} to {formatDate(payment.payment_period_end)} / {payment.payment_method?.replaceAll('_', ' ') || 'Not set'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No salary payments recorded.</p>
                    )}
                  </div>
                </Section>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
