import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Factory, Boxes, Users,
  Menu, X, User, Settings as SettingsIcon, ChevronRight,
  ShieldCheck, HardDrive, Sparkles, LogIn, LogOut
} from 'lucide-react';
import Dashboard from './views/Dashboard';
import WorkOrders from './views/WorkOrders';
import Production from './views/Production';
import Materials from './views/Materials';
import FloorOps from './views/FloorOps';
import Profile from './views/Profile';
import Settings from './views/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import AuthModal from './components/AuthModal';
import CloudSetupModal from './components/CloudSetupModal';
import { triggerHaptic, showToast } from './utils/feedback';
import { getUserProfile, initCloudSync, subscribeCloudStatus, setUserProfile } from './utils/storage';
import { subscribeAuthState, logoutUser } from './utils/firebase';
import { initBackButtonListener, useBackAction } from './utils/backButton';

function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showCloudSetupGuide, setShowCloudSetupGuide] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfileState] = useState({
    name: 'Plant Operator',
    role: 'Operations Supervisor',
    badgeId: 'OP-501',
    department: 'Shop Floor'
  });
  const [cloudStatus, setCloudStatus] = useState({ isOnline: false, projectId: 'prodpulse-cloud' });

  useEffect(() => {
    initCloudSync();
    const unsubCloud = subscribeCloudStatus((status) => {
      setCloudStatus(status);
    });
    const unsubAuth = subscribeAuthState((user) => {
      setCurrentUser(user);
      if (user) {
        setUserProfileState(prev => ({
          ...prev,
          name: user.displayName || user.email?.split('@')[0] || prev.name,
          email: user.email || ''
        }));
      }
    });
    return () => {
      unsubCloud();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = await getUserProfile();
        if (p && p.name) setUserProfileState(p);
      } catch (err) {
        console.error('Failed to load profile for menu:', err);
      }
    };
    loadProfile();
  }, [location.pathname]);

  // Keep locationRef synchronized for hardware back button handler
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Initialize Android Hardware Back Button listener
  useEffect(() => {
    return initBackButtonListener({ navigate, locationRef });
  }, [navigate]);

  // Back button closes side menu drawer if open (priority 100)
  useBackAction(() => {
    setIsMenuOpen(false);
    return true;
  }, isMenuOpen, 100);

  // Back button closes authentication modal if open (priority 100)
  useBackAction(() => {
    setIsAuthModalOpen(false);
    return true;
  }, isAuthModalOpen, 100);

  // Close drawer on path change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Orders', path: '/orders', icon: ClipboardList },
    { name: 'Production', path: '/production', icon: Factory },
    { name: 'Materials', path: '/materials', icon: Boxes },
    { name: 'Floor Ops', path: '/floor-ops', icon: Users },
  ];

  const menuSections = [
    {
      title: 'Management & Configuration',
      items: [
        {
          name: 'Operator Profile',
          path: '/profile',
          icon: User,
          badge: userProfile.badgeId || 'ID Badge',
          description: 'Employee ID, department & operator shift metrics'
        },
        {
          name: 'System Settings',
          path: '/settings',
          icon: SettingsIcon,
          badge: 'Config',
          description: 'Plant configuration, BOM auto-deduction & data backup'
        }
      ]
    },
    {
      title: 'Operations & Telemetry',
      items: [
        { name: 'Executive Dashboard', path: '/', icon: LayoutDashboard, description: 'Live plant KPIs and throughput summary' },
        { name: 'Work Orders', path: '/orders', icon: ClipboardList, description: 'BOM planning, order dispatch & status' },
        { name: 'Production Lines', path: '/production', icon: Factory, description: 'Real-time assembly lines & recipe deduction' },
        { name: 'Inventory & Materials', path: '/materials', icon: Boxes, description: 'Raw materials, stock tracking & QR tags' },
        { name: 'Floor Operations', path: '/floor-ops', icon: Users, description: 'Staff roster, QA inspections & shift logs' },
      ]
    }
  ];

  const getInitials = (name) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const navigateTo = (path) => {
    triggerHaptic('selection');
    setIsMenuOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    await triggerHaptic('medium');
    await logoutUser();
    showToast('Signed out of cloud account');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">
      {/* Top Mobile & Desktop App Bar */}
      <header className="bg-slate-900 text-white shrink-0 shadow-md border-b border-slate-800 z-30 pt-safe-top">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Factory size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">PROD<span className="text-blue-400">PULSE</span></h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Shop Floor, Work Orders & Material Telemetry</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Cloud Sync Status Badge */}
            {cloudStatus.isOnline ? (
              <span 
                className="text-[11px] font-bold text-emerald-400 flex items-center bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
                title={`Cloud Firestore Connected: ${cloudStatus.projectId}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                Cloud Synced
              </span>
            ) : cloudStatus.status === 'DATABASE_NOT_CREATED' ? (
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowCloudSetupGuide(true); }}
                className="text-[11px] font-bold text-amber-300 flex items-center bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-2.5 py-1 rounded-full border border-amber-500/30 cursor-pointer transition"
                title="Cloud Firestore database is not created yet in Firebase Console. Tap for quick guide."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />
                Setup Cloud DB
              </button>
            ) : cloudStatus.status === 'PERMISSION_DENIED' ? (
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowCloudSetupGuide(true); }}
                className="text-[11px] font-bold text-rose-300 flex items-center bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 px-2.5 py-1 rounded-full border border-rose-500/30 cursor-pointer transition"
                title="Firestore Security Rules blocked access. Tap to fix."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
                Rules Blocked
              </button>
            ) : (
              <span 
                className="text-[11px] font-bold text-amber-300 flex items-center bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"
                title="Running in local offline mode (changes stay saved on this device)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
                Offline Mode
              </span>
            )}

            {/* Authentication Button in Header */}
            {currentUser ? (
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setIsMenuOpen(true);
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition text-xs cursor-pointer"
                title={`Signed in as ${currentUser.email}`}
              >
                <div className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {getInitials(currentUser.displayName || currentUser.email)}
                </div>
                <span className="text-xs text-slate-200 font-semibold max-w-[100px] truncate hidden sm:inline">
                  {currentUser.displayName || currentUser.email.split('@')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                title="Sign in with Email or Google"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            )}

            {/* Menu Trigger Button */}
            <button
              onClick={() => {
                triggerHaptic('selection');
                setIsMenuOpen(true);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 transition shadow-sm cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu size={18} className="text-slate-300" />
              <span className="text-xs font-semibold hidden md:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6 max-w-7xl w-full mx-auto pb-24 md:pb-8">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Slide-over Menu Drawer & Modal */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/75 transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-[85vw] max-w-sm sm:max-w-md bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250">
              {/* Drawer Header */}
              <div className="bg-slate-900 px-4 sm:px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md">
                    PP
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Main Application Menu</h2>
                    <p className="text-[11px] text-slate-400">ProdPulse Industrial System</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                  title="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Active Operator / Account Card */}
                <div 
                  onClick={() => navigateTo('/profile')}
                  className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200/80 hover:border-blue-300 transition cursor-pointer shadow-sm group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-md">
                      {getInitials(currentUser?.displayName || userProfile.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                          {currentUser?.displayName || userProfile.name || 'Plant Operator'}
                        </h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          {userProfile.badgeId || 'OP-501'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{currentUser?.email || userProfile.role || 'Operations Lead'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{userProfile.department || 'Floor Ops'}</p>
                    </div>
                    <ChevronRight size={18} className="text-blue-500 group-hover:translate-x-1 transition" />
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-blue-100/80 flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>Manage Operator Badge & Shift</span>
                    <span className="text-[11px] bg-white px-2 py-0.5 rounded-full border border-blue-200">Open Profile</span>
                  </div>
                </div>

                {/* Cloud Account Quick Action */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-xs font-bold text-slate-800">
                      {currentUser ? 'Cloud Account Active' : 'Offline / Guest Mode'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {currentUser ? currentUser.email : 'Sign in to link cloud changes to your name'}
                    </p>
                  </div>
                  {currentUser ? (
                    <button
                      onClick={handleSignOut}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition flex items-center space-x-1 cursor-pointer shrink-0"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setIsAuthModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center space-x-1 shadow-sm cursor-pointer shrink-0"
                    >
                      <LogIn size={13} />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>

                {/* Navigation Sections */}
                {menuSections.map((section, idx) => (
                  <div key={idx} className="space-y-2">
                    <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-1">
                      {section.title}
                    </h4>
                    <div className="space-y-1.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => navigateTo(item.path)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer ${
                              isCurrent
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className={`p-2 rounded-lg ${isCurrent ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <Icon size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : 'text-slate-800'}`}>
                                    {item.name}
                                  </span>
                                  {item.badge && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      isCurrent ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className={`text-[11px] truncate ${isCurrent ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ChevronRight size={16} className={isCurrent ? 'text-white' : 'text-slate-400'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* System Status Telemetry */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center">
                      <HardDrive size={13} className="mr-1.5 text-slate-400" />
                      Storage Engine
                    </span>
                    <span className="font-bold text-slate-700">IndexedDB + Firestore</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center">
                      <Sparkles size={13} className="mr-1.5 text-slate-400" />
                      Recipe Auto-Deduct
                    </span>
                    <span className="font-bold text-emerald-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center">
                      <ShieldCheck size={13} className="mr-1.5 text-slate-400" />
                      Cloud Security
                    </span>
                    <span className="font-bold text-blue-600">Firebase Auth</span>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between pb-[max(20px,env(safe-area-inset-bottom,20px))]">
                <button
                  onClick={() => navigateTo('/settings')}
                  className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition cursor-pointer"
                >
                  <SettingsIcon size={14} />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => navigateTo('/profile')}
                  className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                >
                  <User size={14} />
                  <span>My Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Dock (5-Tab Enterprise Dock) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] z-40 pb-[max(20px,env(safe-area-inset-bottom,20px))] pt-1">
        <div className="max-w-lg mx-auto px-2 py-1 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => triggerHaptic('light')}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-150 relative ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-600 scale-105' : ''}`}>
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight mt-0.5 ${isActive ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(user, profile) => {
          setCurrentUser(user);
          setUserProfileState(profile);
        }}
      />

      {/* Cloud Database Setup Modal */}
      <CloudSetupModal
        isOpen={showCloudSetupGuide}
        onClose={() => setShowCloudSetupGuide(false)}
        status={cloudStatus.status}
        projectId={cloudStatus.projectId}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<WorkOrders />} />
          <Route path="/production" element={<Production />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/floor-ops" element={<FloorOps />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
