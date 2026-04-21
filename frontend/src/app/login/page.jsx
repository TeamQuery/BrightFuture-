'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import toast from 'react-hot-toast';
import { BookOpen, Eye, EyeOff, GraduationCap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@brightfuture.edu.gh');
  const [password, setPassword] = useState('password123');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogins = [
    { label: 'Admin', email: 'admin@brightfuture.edu.gh', color: 'bg-blue-100 text-blue-700' },
    { label: 'Teacher', email: 'abena.mensah@brightfuture.edu.gh', color: 'bg-purple-100 text-purple-700' },
    { label: 'Parent', email: 'grace.tetteh@brightfuture.edu.gh', color: 'bg-green-100 text-green-700' },
    { label: 'Librarian', email: 'akua.sarpong@brightfuture.edu.gh', color: 'bg-orange-100 text-orange-700' },
  ];

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
            A comprehensive school management system for Ghana's brightest future. Manage students, staff, attendance, grades, and more.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-10">
            {[['500+','Students'],['25+','Teachers'],['99%','Attendance']].map(([n,l]) => (
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
            <p className="text-gray-500 text-sm mb-6">Access your school management dashboard</p>

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

            <div className="mt-6">
              <p className="text-xs text-gray-400 text-center mb-3">Quick demo login</p>
              <div className="grid grid-cols-2 gap-2">
                {quickLogins.map(({ label, email: e, color }) => (
                  <button key={label} type="button"
                    onClick={() => { setEmail(e); setPassword('password123'); }}
                    className={`${color} text-xs font-medium py-2 px-3 rounded-lg hover:opacity-80 transition-opacity`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">All passwords: <code className="bg-gray-100 px-1 rounded">password123</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
