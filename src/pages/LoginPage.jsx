import { useState } from 'react';
import { Navigate } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Invalid email or password',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'Invalid email address',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/popup-closed-by-user': 'Sign-in popup was closed',
};

function getErrorMessage(err) {
  return ERROR_MESSAGES[err?.code] || err?.message || 'Something went wrong';
}

export default function LoginPage() {
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0C0B] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded bg-[#DA7756]/15 flex items-center justify-center">
            <span className="font-mono text-base font-bold text-[#DA7756]">P</span>
          </div>
          <span className="font-['Epilogue'] text-lg font-medium text-[#F5F0E8]">Prelude</span>
        </div>

        {/* Card */}
        <div className="bg-[#171614] border border-[#2C2B28] rounded-lg p-6">
          <h2 className="text-sm font-medium text-[#F5F0E8] text-center mb-1">
            {isSignUp ? 'Create an account' : 'Sign in to Prelude'}
          </h2>
          <p className="text-[10px] text-[#6B6560] text-center mb-5">
            {isSignUp ? 'Get started with music intelligence' : 'Welcome back'}
          </p>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#0D0C0B] border border-[#2C2B28] hover:border-[#3D3B37] text-xs text-[#F5F0E8] transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#2C2B28]" />
            <span className="text-[9px] font-mono text-[#6B6560] uppercase">or</span>
            <div className="flex-1 h-px bg-[#2C2B28]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 focus-within:border-[#3D3B37] transition-colors">
              <Mail size={13} className="text-[#6B6560] shrink-0" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 focus-within:border-[#3D3B37] transition-colors">
              <Lock size={13} className="text-[#6B6560] shrink-0" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#C75F4F]">
                <AlertCircle size={11} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-[#DA7756] text-[#0D0C0B] text-xs font-medium hover:bg-[#DA7756]/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogIn size={13} />
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p className="text-center text-[10px] text-[#6B6560] mt-4">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-[#DA7756] hover:underline cursor-pointer"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
