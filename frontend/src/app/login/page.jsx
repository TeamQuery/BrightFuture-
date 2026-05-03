'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading, getErrorMessage } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [authLoading, router, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #0891b2 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <GraduationCap size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl">BrightFuture School</span>
        </div>
        <div>
          <h1 className="font-display font-bold text-5xl leading-tight mb-6">
            Empowering<br/>Education<br/>Through<br/>Technology
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Secure access for BrightFuture staff and families. Sessions use short-lived access tokens with rotating refresh tokens for safer sign-in.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-10">
            {[['JWT','Rotating'],['RBAC','Enforced'],['RFC7807','Errors']].map(([n,l]) => (
              <div key={l} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="font-display font-bold text-2xl">{n}</div>
                <div className="text-white/60 text-sm mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-sm">© 2025 BrightFuture Primary School · Accra, Ghana</p>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <span className="font-display font-bold text-lg text-gray-800">BrightFuture School</span>
            </div>

            <h2 className="font-display font-bold text-2xl text-gray-900 mb-1">Sign in</h2>
            <p className="text-gray-500 text-sm mb-6">Access the BrightFuture backend workspace</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="input" placeholder="your@school.edu.gh"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10" placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">New here?</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Parents can create their own account. Staff accounts should be provisioned by an administrator.
                  </p>
                </div>
              </div>
              <Link
                href="/register"
                className="block w-full text-center py-3 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Create Parent Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
