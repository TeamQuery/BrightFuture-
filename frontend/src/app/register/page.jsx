'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const passwordRules = [
  {
    label: 'At least 12 characters',
    test: (value) => value.length >= 12,
  },
  {
    label: 'At least one lowercase letter',
    test: (value) => /[a-z]/.test(value),
  },
  {
    label: 'At least one uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    label: 'At least one number',
    test: (value) => /[0-9]/.test(value),
  },
  {
    label: 'At least one special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
  {
    label: 'No spaces at the beginning or end',
    test: (value) => value.trim() === value,
  },
];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, user, loading, getErrorMessage } = useAuth();
  const router = useRouter();
  const unmetPasswordRules = passwordRules.filter((rule) => !rule.test(form.password));
  const passwordIsValid = unmetPasswordRules.length === 0;

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, router, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (!passwordIsValid) {
      toast.error(unmetPasswordRules[0].label);
      return;
    }

    setSubmitting(true);

    try {
      const nextUser = await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });

      toast.success(`Welcome, ${nextUser.name.split(' ')[0]}!`);
      router.push('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0f172a 45%, #1d4ed8 100%)' }}>
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <GraduationCap size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl">BrightFuture School</span>
        </div>

        <div>
          <h1 className="font-display font-bold text-5xl leading-tight mb-6">
            Create A<br />Secure Parent<br />Portal Account
          </h1>
        </div>

        <p className="text-white/40 text-sm">Use a strong password with uppercase, lowercase, numbers, and symbols.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <span className="font-display font-bold text-lg text-gray-800">BrightFuture School</span>
            </div>

            <h2 className="font-display font-bold text-2xl text-gray-900 mb-1">Create account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Grace Tetteh"
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="parent@example.com"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    required
                    minLength={12}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Minimum 12 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input pr-10"
                    required
                    minLength={12}
                    value={form.confirmPassword}
                    onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !passwordIsValid}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0f766e, #2563eb)' }}
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <UserPlus size={16} />
                Password policy
              </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {passwordRules.map((rule) => {
                      const isMet = rule.test(form.password);

                      return (
                        <span
                          key={rule.label}
                          className={`block ${isMet ? 'text-emerald-700' : 'text-slate-500'}`}
                        >
                          {isMet ? 'OK' : '-'} {rule.label}
                        </span>
                      );
                    })}
                  </div>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
