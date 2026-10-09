import React, { useState } from 'react';
import { 
  Mail, Lock, User, LogIn, UserPlus, X, 
  AlertCircle, CheckCircle2, KeyRound, Sparkles,
  ShieldCheck, Loader2
} from 'lucide-react';
import { 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  resetUserPassword 
} from '../utils/firebase';
import { triggerHaptic, showToast } from '../utils/feedback';
import { getUserProfile, setUserProfile } from '../utils/storage';

export default function AuthModal({ isOpen, onClose, currentUser, onAuthSuccess }) {
  const [mode, setMode] = useState('LOGIN'); // 'LOGIN' | 'REGISTER' | 'FORGOT'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('Operations Supervisor');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const getCleanErrorMessage = (err) => {
    const code = err.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Incorrect email or password. Please verify and try again.';
    }
    if (code.includes('email-already-in-use')) {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code.includes('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (code.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'Google sign-in popup was cancelled.';
    }
    if (code.includes('operation-not-allowed')) {
      return 'This sign-in provider is not enabled in Firebase Console. Please turn it on in the Authentication tab.';
    }
    return err.message || 'An error occurred during authentication.';
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (mode === 'FORGOT') {
      setLoading(true);
      try {
        await resetUserPassword(email);
        setSuccessMsg(`Password reset link sent to ${email.trim()}. Check your inbox.`);
        await triggerHaptic('success');
      } catch (err) {
        setErrorMsg(getCleanErrorMessage(err));
        await triggerHaptic('warning');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (mode === 'REGISTER') {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      let user;
      if (mode === 'LOGIN') {
        user = await loginWithEmail(email, password);
        await triggerHaptic('success');
        showToast(`Welcome back, ${user.displayName || user.email}!`);
      } else {
        user = await registerWithEmail(email, password, displayName);
        await triggerHaptic('success');
        showToast(`Account created successfully!`);
      }

      // Sync user profile to app
      if (user) {
        const existing = await getUserProfile();
        const updatedProfile = {
          name: user.displayName || displayName.trim() || existing?.name || user.email.split('@')[0],
          email: user.email,
          role: role || existing?.role || 'Operations Supervisor',
          department: existing?.department || 'Main Assembly & Floor',
          badgeId: existing?.badgeId || ('OP-' + Math.floor(100 + Math.random() * 900)),
          avatarColor: existing?.avatarColor || 'blue',
          shift: existing?.shift || 'Morning'
        };
        await setUserProfile(updatedProfile);
        if (onAuthSuccess) onAuthSuccess(user, updatedProfile);
      }
      onClose();
    } catch (err) {
      setErrorMsg(getCleanErrorMessage(err));
      await triggerHaptic('warning');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      await triggerHaptic('success');
      showToast(`Signed in with Google as ${user.displayName || user.email}`);

      if (user) {
        const existing = await getUserProfile();
        const updatedProfile = {
          name: user.displayName || existing?.name || user.email.split('@')[0],
          email: user.email,
          role: existing?.role || 'Operations Supervisor',
          department: existing?.department || 'Main Assembly & Floor',
          badgeId: existing?.badgeId || ('OP-' + Math.floor(100 + Math.random() * 900)),
          avatarColor: existing?.avatarColor || 'indigo',
          shift: existing?.shift || 'Morning'
        };
        await setUserProfile(updatedProfile);
        if (onAuthSuccess) onAuthSuccess(user, updatedProfile);
      }
      onClose();
    } catch (err) {
      setErrorMsg(getCleanErrorMessage(err));
      await triggerHaptic('warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">ProdPulse Account</h2>
              <p className="text-xs text-blue-200">Cloud Sync & Industrial Profile</p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          {mode !== 'FORGOT' && (
            <div className="mt-5 grid grid-cols-2 gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => { setMode('LOGIN'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  mode === 'LOGIN' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('REGISTER'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  mode === 'REGISTER' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {/* Status Messages */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start space-x-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-medium leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          {mode !== 'FORGOT' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition active:scale-98 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {/* Official Google 'G' SVG Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="my-5 flex items-center">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">or email</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'REGISTER' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. John Miller"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Plant Role / Position</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="Operations Supervisor">Operations Supervisor</option>
                    <option value="Plant Manager">Plant Manager</option>
                    <option value="Floor Operator">Floor Operator</option>
                    <option value="Quality Inspector">Quality Inspector</option>
                    <option value="Maintenance Engineer">Maintenance Engineer</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {mode !== 'FORGOT' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  {mode === 'LOGIN' && (
                    <button
                      type="button"
                      onClick={() => { setMode('FORGOT'); setErrorMsg(''); setSuccessMsg(''); }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/20 transition active:scale-98 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === 'LOGIN' ? (
                <>
                  <LogIn size={16} />
                  <span>Sign In to Plant System</span>
                </>
              ) : mode === 'REGISTER' ? (
                <>
                  <UserPlus size={16} />
                  <span>Create Plant Account</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>

            {mode === 'FORGOT' && (
              <button
                type="button"
                onClick={() => { setMode('LOGIN'); setErrorMsg(''); setSuccessMsg(''); }}
                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Back to Sign In
              </button>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center">
            <Sparkles size={12} className="mr-1 text-blue-500" />
            ProdPulse Cloud Auth
          </span>
          <button
            onClick={onClose}
            className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Continue as Guest (Offline)
          </button>
        </div>
      </div>
    </div>
  );
}
