import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, ShieldCheck, Mail, Phone, Building, Briefcase, 
  Clock, Save, ArrowLeft, Award, CheckCircle2, Sparkles,
  QrCode, Hash, Sun, Moon, Sunset, LogIn, LogOut
} from 'lucide-react';
import { getUserProfile, setUserProfile, getProduction } from '../utils/storage';
import { triggerHaptic, showToast } from '../utils/feedback';
import { subscribeAuthState, logoutUser } from '../utils/firebase';
import AuthModal from '../components/AuthModal';
import { useBackAction } from '../utils/backButton';

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: 'Plant Operator',
    role: 'Operations Supervisor',
    department: 'Main Assembly & Floor',
    badgeId: 'OP-501',
    email: '',
    phone: '',
    shift: 'Morning',
    avatarColor: 'blue'
  });

  const [stats, setStats] = useState({
    totalBatches: 0,
    totalUnits: 0
  });

  const [saving, setSaving] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useBackAction(() => {
    if (isAuthModalOpen) {
      setIsAuthModalOpen(false);
      return true;
    }
    return false;
  }, isAuthModalOpen, 90);

  useEffect(() => {
    const unsub = subscribeAuthState((user) => {
      setAuthUser(user);
      if (user) {
        setProfile(prev => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email
        }));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadProfileData = async () => {
      const data = await getUserProfile();
      if (data) setProfile(data);

      const prod = await getProduction();
      const history = Array.isArray(prod.history) ? prod.history : [];
      const totalUnits = history.reduce((acc, h) => acc + (Number(h.produced) || 0), 0);
      setStats({
        totalBatches: history.length,
        totalUnits
      });
    };
    loadProfileData();
    window.addEventListener('prodpulse-data-changed', loadProfileData);
    window.addEventListener('prodpulse-cloud-sync', loadProfileData);
    return () => {
      window.removeEventListener('prodpulse-data-changed', loadProfileData);
      window.removeEventListener('prodpulse-cloud-sync', loadProfileData);
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await triggerHaptic('success');
    await setUserProfile(profile);
    await showToast('Profile updated successfully!');
    setSaving(false);
  };

  const getInitials = (name) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getCurrentShift = () => {
    const hr = new Date().getHours();
    if (hr >= 6 && hr < 14) return 'Morning';
    if (hr >= 14 && hr < 22) return 'Day';
    return 'Night';
  };

  const ShiftIcon = ({ shift }) => {
    if (shift === 'Night') return <Moon size={14} className="text-indigo-400 mr-1" />;
    if (shift === 'Day') return <Sunset size={14} className="text-amber-500 mr-1" />;
    return <Sun size={14} className="text-yellow-500 mr-1" />;
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => { triggerHaptic('light'); navigate(-1); }}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            title="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Operator Profile</h2>
            <p className="text-xs text-slate-500 font-medium">Digital ID badge, credentials & shift duties</p>
          </div>
        </div>
      </div>

      {/* Digital ID Badge Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
                <span className="text-xl sm:text-2xl font-black text-white tracking-wider">
                  {getInitials(profile.name)}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-white">{profile.name || 'Plant Operator'}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  Active
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium">{profile.role || 'Production Supervisor'}</p>
              <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                <span className="flex items-center"><Hash size={12} className="mr-0.5 text-slate-500" /> {profile.badgeId || 'OP-501'}</span>
                <span>•</span>
                <span className="flex items-center"><Building size={12} className="mr-0.5 text-slate-500" /> {profile.department || 'Floor Ops'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex sm:flex-col justify-around sm:justify-center items-center sm:items-end text-right">
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Assigned Shift</span>
              <span className="text-xs font-bold text-white flex items-center mt-0.5 sm:justify-end">
                <ShiftIcon shift={profile.shift} /> {profile.shift || 'Morning'}
              </span>
            </div>
            <div className="mt-0 sm:mt-2 text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Operator Output</span>
              <span className="text-xs font-bold text-emerald-400">{stats.totalUnits.toLocaleString()} units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Telemetry Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Batches Run</span>
            <span className="text-lg font-black text-slate-900">{stats.totalBatches} runs</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Security Clearance</span>
            <span className="text-lg font-black text-emerald-600">Level 3 (Supervisor)</span>
          </div>
        </div>
      </div>

      {/* Firebase Cloud Account & Sign In Section */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              authUser ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {authUser ? 'Cloud Account Active' : 'Offline / Guest Session'}
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  authUser ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {authUser ? (authUser.providerData[0]?.providerId === 'google.com' ? 'Google Account' : 'Email Account') : 'Local'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {authUser 
                  ? `Signed in as ${authUser.email}` 
                  : 'Sign in to sync your name, recipes and stock changes across all devices'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {authUser ? (
              <button
                type="button"
                onClick={async () => {
                  await triggerHaptic('medium');
                  await logoutUser();
                  showToast('Signed out of cloud account');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <LogIn size={14} />
                <span>Sign In with Email / Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
          <User size={16} className="text-blue-600" />
          <span>Operator Credentials & Details</span>
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Alex Mercer"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Badge ID / Code *</label>
              <input
                type="text"
                placeholder="e.g. OP-501"
                value={profile.badgeId}
                onChange={(e) => setProfile({ ...profile, badgeId: e.target.value })}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role / Job Title</label>
              <input
                type="text"
                placeholder="e.g. Operations Supervisor"
                value={profile.role}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Department / Plant Cell</label>
              <input
                type="text"
                placeholder="e.g. Main Assembly & Floor"
                value={profile.department}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Primary Shift Segmented Cards */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">Primary Shift Assignment</label>
              <span className="text-[10px] text-blue-600 font-bold">Auto-detected Clock Duty</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { id: 'Morning', label: 'Morning', time: '06:00 - 14:00', icon: Sun },
                { id: 'Day', label: 'Day', time: '14:00 - 22:00', icon: Sunset },
                { id: 'Night', label: 'Night', time: '22:00 - 06:00', icon: Moon },
              ].map(sh => {
                const isSelected = profile.shift === sh.id;
                const isCurrent = getCurrentShift() === sh.id;
                const IconComp = sh.icon;

                return (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setProfile({ ...profile, shift: sh.id }); }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center relative ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isCurrent && (
                      <span className={`absolute -top-1.5 right-1.5 px-1.5 py-0.2 rounded-full text-[8px] font-black tracking-wider uppercase ${
                        isSelected ? 'bg-amber-400 text-slate-900' : 'bg-blue-600 text-white animate-pulse'
                      }`}>
                        LIVE
                      </span>
                    )}
                    <IconComp size={18} className={isSelected ? 'text-white' : 'text-slate-500'} />
                    <span className="text-xs font-bold mt-1.5">{sh.label}</span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {sh.time}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
              <input
                type="email"
                placeholder="operator@plant.internal"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone / Ext</label>
              <input
                type="tel"
                placeholder="+1 (555) 019-283"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={authUser}
        onAuthSuccess={(user, updatedProfile) => {
          setAuthUser(user);
          if (updatedProfile) setProfile(updatedProfile);
        }}
      />
    </div>
  );
}
