'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Registration signs you straight into the system and issues a protected refresh cookie for future sessions.
          </p>
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
            <p className="text-gray-500 text-sm mb-6">Parent registration is enabled on the backend</p>

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
                disabled={submitting}
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
              <p className="text-xs text-slate-500 mt-2">
                The backend enforces 12+ characters with upper, lower, number, and symbol requirements.
              </p>
            </div>

            <p className="text-sm text-gray-500 mt-6 text-center">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
