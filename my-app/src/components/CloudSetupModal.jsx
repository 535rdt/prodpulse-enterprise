import React from 'react';
import { 
  Database, X, ExternalLink, CheckCircle2, AlertTriangle, 
  Copy, ShieldAlert, Sparkles, CloudOff 
} from 'lucide-react';
import { triggerHaptic, showToast, copyToClipboard } from '../utils/feedback';

export default function CloudSetupModal({ isOpen, onClose, status, projectId = 'prodpulse-cloud' }) {
  if (!isOpen) return null;

  const isRuleError = status === 'PERMISSION_DENIED';
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore`;

  const recommendedRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_workspaces/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`;

  const handleCopyRules = async () => {
    await copyToClipboard(recommendedRules);
    await triggerHaptic('success');
    showToast('Security rules copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
              isRuleError ? 'bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 shadow-blue-500/30'
            }`}>
              {isRuleError ? <ShieldAlert size={24} /> : <Database size={24} />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {isRuleError ? 'Firestore Rules Blocked' : 'Cloud Database Setup Required'}
              </h2>
              <p className="text-xs text-indigo-200">Firebase Project: {projectId}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start space-x-3">
            <Sparkles size={18} className="shrink-0 text-blue-600 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block">Your local data is 100% safe!</span>
              All your entries are permanently saved on this device under your account profile. To enable 2-way cloud backup and multi-device sync, Cloud Firestore needs to be initialized in your Firebase Console.
            </div>
          </div>

          {!isRuleError ? (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Follow these 3 steps to activate Cloud Sync:</h3>

              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <span className="font-semibold text-slate-900 block">Open Firebase Console</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">Click the button below to open Cloud Firestore for project <b>{projectId}</b>.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <span className="font-semibold text-slate-900 block">Click "Create database"</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">Choose your preferred location and click <b>Next</b>.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                <div>
                  <span className="font-semibold text-slate-900 block">Select Security Rules</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">Select <b>"Start in test mode"</b> (or use the authenticated production rules below), then click <b>Create</b>.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Update Production Rules:</h3>
              <p className="text-slate-600 leading-relaxed">
                In Firebase Console, "Production Mode" sets <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">allow read, write: if false;</code> by default. Replace it with the per-user private rules below:
              </p>
            </div>
          )}

          {/* Copyable Rules Box */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">Per-User Private Rules</span>
              <button
                type="button"
                onClick={handleCopyRules}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Copy size={12} />
                <span>Copy Rules</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
              {recommendedRules}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Continue Locally
          </button>
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic('medium')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Open Firebase Console</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
