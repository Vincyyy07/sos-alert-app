import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

type Mode = 'signin' | 'signup';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/popup-closed-by-user': return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked': return 'Pop-up was blocked by your browser. Please allow pop-ups.';
    case 'auth/operation-not-allowed': return 'Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in methods.';
    case 'auth/network-request-failed': return 'Network error. Check your internet connection.';
    default: return code ? `Error: ${code}` : 'Something went wrong. Please try again.';
  }
}

const phoneRegex = /^\+91 [0-9]{10}$/;

export default function Login() {
  const { user, signIn, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91 ');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!name.trim()) { setError('Please enter your name.'); return; }
      if (!phoneRegex.test(phoneNumber)) { setError('Please enter a valid 10-digit phone number.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name.trim(), phoneNumber);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      const code = err?.code || '';
      setError(getFirebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn();
    } catch (err: any) {
      const code = err?.code || '';
      setError(getFirebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col relative overflow-hidden">
      {/* Top Status Bar */}
      <div className="fixed top-0 left-0 w-full bg-on-background/10 backdrop-blur-md py-2 px-8 flex items-center justify-between z-50 border-b border-outline">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent active-status-pulse"></div>
          <span className="text-on-surface-variant/40 text-[10px] font-mono uppercase tracking-widest">Encrypted Session Ready</span>
        </div>
        <span className="text-on-surface-variant/20 text-[10px] font-mono">v2.4.0-SECURE</span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-screen pt-10">

        {/* ── Left decorative panel (desktop only) ── */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-red-950/40 to-black">
          {/* Radar rings decoration */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="radar-ring w-[200px] h-[200px]"></div>
            <div className="radar-ring w-[360px] h-[360px]"></div>
            <div className="radar-ring w-[520px] h-[520px]"></div>
            <div className="radar-ring w-[680px] h-[680px]"></div>
          </div>
          <div className="relative z-10 text-center px-12 space-y-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-3xl shadow-2xl sos-glow">
              <span className="material-symbols-outlined text-white text-[40px] font-fill">shield_with_heart</span>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-widest uppercase mb-3">
                GUARDIAN<span className="text-red-500">OS</span>
              </h1>
              <p className="text-sm font-light text-white/40 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                High-stakes personal security protocol
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto text-left">
              {[
                { icon: 'emergency_share', label: 'One-hold SOS trigger' },
                { icon: 'group', label: 'Guardian escalation chain' },
                { icon: 'location_on', label: 'Live GPS tracking' },
                { icon: 'timer', label: 'Automated safety check-in' },
              ].map(({ icon, label }) => (
                <div key={icon} className="flex items-center gap-3 text-white/40">
                  <span className="material-symbols-outlined text-accent text-sm">{ icon }</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex flex-1 lg:max-w-lg xl:max-w-xl flex-col items-center justify-center px-6 py-12">
          <main className="w-full max-w-[440px] flex flex-col z-10">
            {/* Logo (mobile only) */}
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-6 shadow-2xl sos-glow">
                <span className="material-symbols-outlined text-white text-[32px] font-fill">shield_with_heart</span>
              </div>
              <h1 className="text-3xl font-extrabold text-on-background tracking-widest uppercase mb-2">
                GUARDIAN<span className="text-red-600">OS</span>
              </h1>
              <p className="text-sm font-light text-on-surface-variant uppercase tracking-[0.2em]">High-stakes security protocol active</p>
            </div>

            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold text-on-background tracking-tight">Welcome back</h2>
              <p className="text-on-surface-variant text-sm mt-1">Sign in to access your security dashboard</p>
            </div>

            <div className="glass-panel p-8 rounded-3xl shadow-2xl space-y-5">
              
              {/* Mode Toggle */}
              <div className="flex rounded-xl overflow-hidden border border-outline p-1 bg-on-background/5 gap-1">
                <button
                  id="signin-tab"
                  onClick={() => { setMode('signin'); setError(''); }}
                  className={`flex-1 h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    mode === 'signin' ? 'bg-red-600 text-white shadow-lg' : 'text-on-surface-variant/30 hover:text-on-surface-variant/60'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="signup-tab"
                  onClick={() => { setMode('signup'); setError(''); }}
                  className={`flex-1 h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    mode === 'signup' ? 'bg-red-600 text-white shadow-lg' : 'text-on-surface-variant/30 hover:text-on-surface-variant/60'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Google Sign In */}
              <button
                id="google-signin-btn"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-3 border border-outline bg-on-background/5 hover:bg-on-background/10 transition-all rounded-xl font-bold text-on-surface uppercase text-[10px] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <img
                  alt="Google Logo"
                  className="w-4 h-4 opacity-80"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAz8TPS8LNIRSsEqHnsc-I7ipww0wv9e2hLXI3ZlhLS-yGtCXFmzQdFsNcVWQxq7i7g5ZFUdVWQiMpU-gxOkpFtR-8oFobXtj9Bs8P1sn9qBMhSZ0FLEIS4SqbxfKtYzngRiOrAGMEccJ_EIAcdF1TOYBA3GukSO_xNCN15bO-Jop1XDWHvFgYjMep2NJqsqCTm6B-p5_7SPzbgM6t_UByEYcHQ6szOz0w4y0gp6H699_hnmbZZLP8Cb9vI7y864IuJRqcGKf49w44"
                />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-outline"></div>
                <span className="text-[10px] font-mono font-bold text-on-surface-variant/20 uppercase tracking-widest">or</span>
                <div className="h-[1px] flex-1 bg-outline"></div>
              </div>

              {/* Email / Password Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>

                {/* Name & Phone (signup only) */}
                {mode === 'signup' && (
                  <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-[0.1em] ml-1" htmlFor="display-name">
                      Your Name
                    </label>
                    <input
                      id="display-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Alex Johnson"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-12 px-4 border border-outline rounded-xl bg-on-background/5 text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:border-accent/50 focus:bg-on-background/10 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-[0.1em] ml-1" htmlFor="phone-number">
                      Phone Number
                    </label>
                    <input
                      id="phone-number"
                      type="tel"
                      required
                      placeholder="+91 9876543210"
                      value={phoneNumber}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val.startsWith('+91 ')) { setPhoneNumber('+91 '); return; }
                        if (val.length <= 14) setPhoneNumber(val);
                      }}
                      className="w-full h-12 px-4 border border-outline rounded-xl bg-on-background/5 text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:border-accent/50 focus:bg-on-background/10 transition-all text-sm"
                    />
                  </div>
                </>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-[0.1em] ml-1" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 px-4 border border-outline rounded-xl bg-on-background/5 text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:border-accent/50 focus:bg-on-background/10 transition-all text-sm"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-[0.1em] ml-1" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-12 px-4 border border-outline rounded-xl bg-on-background/5 text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:border-accent/50 focus:bg-on-background/10 transition-all text-sm"
                  />
                </div>

                {/* Confirm Password (signup only) */}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-[0.1em] ml-1" htmlFor="confirm-password">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full h-12 px-4 border border-outline rounded-xl bg-on-background/5 text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:border-accent/50 focus:bg-on-background/10 transition-all text-sm"
                    />
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs tracking-widest mt-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-[10px] font-bold text-on-surface-variant/20 uppercase tracking-[0.3em]">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                  className="text-accent hover:text-on-surface transition-colors underline underline-offset-2"
                >
                  {mode === 'signin' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

