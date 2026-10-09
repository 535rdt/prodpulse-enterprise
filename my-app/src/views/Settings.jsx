import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Building, Sliders, Shield, 
  Download, Upload, RotateCw, Save, ArrowLeft, CheckCircle2,
  HardDrive, Smartphone, Monitor, Info, Bell, Zap, Layers,
  Cloud, Database, Wifi, WifiOff
} from 'lucide-react';
import { 
  getAppSettings, setAppSettings, exportFullDatabase, 
  importDatabase, clearAllData, subscribeCloudStatus, initCloudSync 
} from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    plantName: 'ProdPulse Facility 1',
    plantLocation: 'Main Plant, Sector 4',
    autoDeductBOM: true,
    defaultDailyTarget: 500,
    enableHaptics: true,
    compactView: false,
    currency: 'USD ($)',
    weightUnit: 'kg'
  });

  const [saving, setSaving] = useState(false);

  const [cloudStatus, setCloudStatus] = useState({ isOnline: false, projectId: 'prodpulse-cloud' });
  const [syncingCloud, setSyncingCloud] = useState(false);

  useEffect(() => {
    const unsub = subscribeCloudStatus((status) => {
      setCloudStatus(status);
    });
    return () => unsub();
  }, []);

  const handleManualCloudSync = async () => {
    setSyncingCloud(true);
    await triggerHaptic('medium');
    initCloudSync();
    await showToast('Checking Cloud Firestore connection...');
    setTimeout(() => {
      setSyncingCloud(false);
    }, 1200);
  };

  useEffect(() => {
    const loadSettings = async () => {
      const data = await getAppSettings();
      if (data) setSettings(data);
    };
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await triggerHaptic('success');
    await setAppSettings(settings);
    await showToast('System preferences saved successfully!');
    setSaving(false);
  };

  const handleExportBackup = async () => {
    try {
      await triggerHaptic('medium');
      const backup = await exportFullDatabase();
      const jsonStr = JSON.stringify(backup, null, 2);
      await shareOrCopy({
        title: `ProdPulse_Backup_${new Date().toISOString().split('T')[0]}`,
        text: 'ProdPulse ERP Full Database Backup',
        jsonString: jsonStr
      });
      await showToast('Database backup generated successfully!');
    } catch (err) {
      console.error(err);
      await showToast('Export failed');
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await triggerHaptic('medium');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await importDatabase(json);
          await showToast('Database restored successfully! Reloading...');
          setTimeout(() => window.location.reload(), 1000);
        } catch {
          await showToast('Invalid backup JSON format');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWipeData = async () => {
    if (window.confirm('WARNING: Erase all stored records and reset to clean production state?')) {
      await triggerHaptic('heavy');
      await clearAllData();
      await showToast('Database erased - clean slate');
      window.location.reload();
    }
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
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System Settings</h2>
            <p className="text-xs text-slate-500 font-medium">Facility profile, recipe automation & data management</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Plant / Facility Configuration Card */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Building size={16} className="text-blue-600" />
            <span>Facility & Plant Configuration</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Plant / Company Name</label>
              <input
                type="text"
                placeholder="e.g. ProdPulse Facility 1"
                value={settings.plantName}
                onChange={(e) => setSettings({ ...settings, plantName: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Plant Location / Unit</label>
              <input
                type="text"
                placeholder="e.g. Sector 4, Bay B"
                value={settings.plantLocation}
                onChange={(e) => setSettings({ ...settings, plantLocation: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default Daily Target (Units)</label>
              <input
                type="number"
                value={settings.defaultDailyTarget}
                onChange={(e) => setSettings({ ...settings, defaultDailyTarget: Number(e.target.value) || 500 })}
                min="10"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Weight Unit</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'kg', label: 'Kilograms', badge: 'kg', desc: 'Metric' },
                  { id: 'lbs', label: 'Pounds', badge: 'lbs', desc: 'Imperial' },
                  { id: 'ton', label: 'Metric Tons', badge: 't', desc: 'Bulk' },
                ].map(u => {
                  const isSelected = settings.weightUnit === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setSettings({ ...settings, weightUnit: u.id }); }}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs font-black">{u.badge}</span>
                      <span className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {u.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Automation & Operations Preferences */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Sliders size={16} className="text-indigo-600" />
            <span>Recipe Automation & Feedback</span>
          </h3>

          <div className="space-y-3">
            {/* Auto Deduct BOM Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="pr-4">
                <span className="text-xs font-bold text-slate-900 block flex items-center">
                  <Layers size={14} className="mr-1.5 text-indigo-600" />
                  Auto-Deduct Raw Materials on Batch Production
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  When a production run is recorded, automatically decrease the warehouse inventory according to the product recipe formula.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoDeductBOM}
                  onChange={(e) => setSettings({ ...settings, autoDeductBOM: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Haptic Feedback Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="pr-4">
                <span className="text-xs font-bold text-slate-900 block flex items-center">
                  <Zap size={14} className="mr-1.5 text-amber-500" />
                  Haptic Feedback & Micro-Interactions
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Provide tactile vibration feedback when confirming production runs and advancing work orders.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enableHaptics}
                  onChange={(e) => setSettings({ ...settings, enableHaptics: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-95 transition flex items-center justify-center space-x-2"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>

      {/* Cloud Database (Firebase Firestore) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Cloud size={16} className="text-blue-600" />
            <span>Cloud Database Sync (Firebase Firestore)</span>
          </h3>
          {cloudStatus.isOnline ? (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
              Connected
            </span>
          ) : cloudStatus.status === 'DATABASE_NOT_CREATED' ? (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
              Database Not Created
            </span>
          ) : cloudStatus.status === 'PERMISSION_DENIED' ? (
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
              Rules Blocked
            </span>
          ) : (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
              Local Device Mode
            </span>
          )}
        </div>

        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Cloud Project ID:</span>
            <span className="font-mono font-bold text-slate-900">{cloudStatus.projectId}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Sync Protocol:</span>
            <span className="font-semibold text-slate-700">Firestore Real-time WebSockets & gRPC</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Offline Resilience:</span>
            <span className="font-semibold text-emerald-600">Active (IndexedDB Fallback)</span>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={syncingCloud}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold active:scale-95 transition flex items-center justify-center space-x-2"
          >
            <RotateCw size={14} className={syncingCloud ? 'animate-spin' : ''} />
            <span>{syncingCloud ? 'Connecting & Syncing...' : 'Sync Now with Cloud Firestore'}</span>
          </button>
        </div>
      </div>

      {/* Database Operations & Backup */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
          <HardDrive size={16} className="text-slate-700" />
          <span>Database Backup & Restoration</span>
        </h3>
        <p className="text-xs text-slate-500">
          All data is persistently saved in local indexed storage. Export regular snapshots to protect recipes and inventory records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="py-3 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition flex items-center justify-center space-x-2 shadow-sm"
          >
            <Download size={15} />
            <span>Export Full Database (JSON)</span>
          </button>

          <label className="py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm">
            <Upload size={15} className="text-blue-600" />
            <span>Restore Backup (.json)</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>

        <div className="pt-2">
          <button
            onClick={handleWipeData}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 active:scale-95 transition flex items-center justify-center space-x-1.5"
          >
            <RotateCw size={14} />
            <span>Reset Database to Clean State</span>
          </button>
        </div>
      </div>

      {/* About Application Information */}
      <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-between font-bold text-slate-700">
          <span>ProdPulse Enterprise Operations</span>
          <span className="text-indigo-600">v1.1.0</span>
        </div>
        <p>Industrial shop floor management, recipe-driven inventory telemetry, and fleet health.</p>
        <p className="text-[11px] text-slate-400 pt-1">
          Platform: Desktop EXE (x64) & Mobile Android APK • Offline First
        </p>
      </div>
    </div>
  );
}
