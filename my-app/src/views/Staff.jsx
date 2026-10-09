import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Phone, Sun, Moon, Sunset, Trash2, 
  Search, X, Share2, Briefcase, Pencil
} from 'lucide-react';
import { getStaff, setStaff } from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';
import { useBackAction } from '../utils/backButton';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShift, setFilterShift] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  useBackAction(() => {
    if (showAddModal) { setShowAddModal(false); return true; }
    if (editingStaff) { setEditingStaff(null); return true; }
    return false;
  }, showAddModal || !!editingStaff, 90);

  const hasActiveFilters = searchQuery.trim() !== '' || filterShift !== 'ALL';
  useBackAction(() => {
    if (hasActiveFilters) {
      setSearchQuery('');
      setFilterShift('ALL');
      return true;
    }
    return false;
  }, hasActiveFilters, 70);

  // Form State
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    shift: 'Morning',
    status: 'On Duty',
    phone: ''
  });

  const loadData = async () => {
    try {
      const list = await getStaff();
      setStaffList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error loading staff list:', err);
      setStaffList([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleDataChange = () => {
      loadData();
    };
    window.addEventListener('prodpulse-data-changed', handleDataChange);
    window.addEventListener('prodpulse-cloud-sync', handleDataChange);
    return () => {
      window.removeEventListener('prodpulse-data-changed', handleDataChange);
      window.removeEventListener('prodpulse-cloud-sync', handleDataChange);
    };
  }, []);

  const saveAndSync = async (updated) => {
    setStaffList(updated);
    await setStaff(updated);
  };

  const handleToggleStatus = async (id) => {
    await triggerHaptic('light');
    const updated = staffList.map(member => {
      if (member && member.id === id) {
        const nextStatus = member.status === 'On Duty' ? 'Off Duty' : 'On Duty';
        return { ...member, status: nextStatus };
      }
      return member;
    });
    await saveAndSync(updated);
    await showToast('Staff shift status updated');
  };

  const handleRemove = async (id, name) => {
    if (window.confirm(`Remove ${name || 'this member'} from active floor roster?`)) {
      await triggerHaptic('heavy');
      const updated = staffList.filter(s => s && s.id !== id);
      await saveAndSync(updated);
      await showToast('Staff member removed');
    }
  };

  const handleStartEdit = (member) => {
    triggerHaptic('light');
    setEditingStaff({
      ...member,
      name: member.name || '',
      role: member.role || '',
      shift: member.shift || 'Morning',
      status: member.status || 'On Duty',
      phone: member.phone || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingStaff.name.trim() || !editingStaff.role.trim()) {
      await showToast('Name and Role are required');
      return;
    }
    await triggerHaptic('success');
    const updated = staffList.map(s => {
      if (s.id === editingStaff.id) {
        return {
          ...s,
          name: editingStaff.name.trim(),
          role: editingStaff.role.trim(),
          shift: editingStaff.shift,
          status: editingStaff.status,
          phone: (editingStaff.phone || '').trim() || '+1 (555) 000-0000'
        };
      }
      return s;
    });
    await saveAndSync(updated);
    setEditingStaff(null);
    await showToast(`Staff member "${editingStaff.name}" updated!`);
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.role) {
      await triggerHaptic('heavy');
      await showToast('Name and Role are required');
      return;
    }

    await triggerHaptic('success');
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-cyan-500 to-blue-600'
    ];
    const randomGrad = gradients[Math.floor(Math.random() * gradients.length)];

    const entry = {
      id: Date.now(),
      name: (newStaff.name || '').trim(),
      role: (newStaff.role || '').trim(),
      shift: newStaff.shift || 'Morning',
      status: newStaff.status || 'On Duty',
      phone: (newStaff.phone || '').trim() || '+1 (555) 000-0000',
      avatarColor: randomGrad
    };

    const updated = [entry, ...staffList];
    await saveAndSync(updated);
    setShowAddModal(false);
    setNewStaff({ name: '', role: '', shift: 'Morning', status: 'On Duty', phone: '' });
    await showToast('New staff member onboarded!');
  };

  const handleExport = async () => {
    await triggerHaptic('light');
    const jsonStr = JSON.stringify(staffList, null, 2);
    await shareOrCopy({
      title: 'Floor Staff Roster',
      text: `Roster list with ${staffList.length} members.`,
      jsonString: jsonStr
    });
  };

  const ShiftIcon = ({ shift }) => {
    if (shift === 'Night') return <Moon size={14} className="text-indigo-400 mr-1" />;
    if (shift === 'Day') return <Sunset size={14} className="text-amber-500 mr-1" />;
    return <Sun size={14} className="text-yellow-500 mr-1" />;
  };

  const filtered = (Array.isArray(staffList) ? staffList : []).filter(s => {
    if (!s) return false;
    const name = (s.name || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    const q = (searchQuery || '').toLowerCase();
    const matchesQuery = name.includes(q) || role.includes(q);
    if (!matchesQuery) return false;

    if (filterShift === 'ON_DUTY') return s.status === 'On Duty';
    if (filterShift === 'ALL') return true;
    return s.shift === filterShift;
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Staff Management</h2>
          <p className="text-xs text-slate-500 font-medium">Shop floor roster & active duty</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm active:scale-95 transition flex items-center space-x-1"
          >
            <Share2 size={16} />
            <span className="text-xs font-bold hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => { triggerHaptic('light'); setShowAddModal(true); }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition"
          >
            <UserPlus size={16} />
            <span>Onboard</span>
          </button>
        </div>
      </div>

      {/* Search & Shift Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by staff name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['ALL', 'ON_DUTY', 'Morning', 'Day', 'Night'].map((shift) => (
            <button
              key={shift}
              onClick={() => { triggerHaptic('light'); setFilterShift(shift); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterShift === shift 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {shift === 'ALL' ? 'All Staff' : shift === 'ON_DUTY' ? '🟢 On Duty Now' : `${shift} Shift`}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((member) => {
          const isOnDuty = member.status === 'On Duty';
          const initialLetter = ((member.name || 'S').trim().charAt(0) || 'S').toUpperCase();

          return (
            <div
              key={member.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${member.avatarColor || 'from-purple-500 to-indigo-600'} text-white font-black text-lg flex items-center justify-center shadow-md shadow-purple-500/10`}>
                      {initialLetter}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{member.name || 'Staff Member'}</h4>
                      <p className="text-xs font-semibold text-purple-700 flex items-center mt-0.5">
                        <Briefcase size={12} className="mr-1 opacity-70" /> {member.role || 'Operator'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleStartEdit(member)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 active:scale-95 transition"
                      title="Edit Staff Member"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleRemove(member.id, member.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition"
                      title="Remove from roster"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <span className="flex items-center font-medium">
                    <ShiftIcon shift={member.shift} /> {member.shift || 'Morning'} Shift
                  </span>
                  {member.phone && (
                    <a
                      href={`tel:${member.phone}`}
                      onClick={() => triggerHaptic('light')}
                      className="flex items-center text-slate-600 hover:text-blue-600 font-semibold"
                    >
                      <Phone size={11} className="mr-1 text-slate-400" /> {member.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Status Toggle Bar */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
                <button
                  onClick={() => handleToggleStatus(member.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center space-x-1.5 active:scale-95 ${
                    isOnDuty 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{member.status || 'On Duty'}</span>
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <Users size={36} className="mx-auto text-slate-300" />
            <h4 className="text-sm font-bold text-slate-800">No staff members found</h4>
            <p className="text-xs text-slate-500">Try adjusting your search query or shift filter.</p>
          </div>
        )}
      </div>

      {/* Onboard Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Onboard Floor Staff</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Role / Position *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assembly Specialist"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Shift
                  </label>
                  <select
                    value={newStaff.shift}
                    onChange={(e) => setNewStaff({ ...newStaff, shift: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStaff.status}
                    onChange={(e) => setNewStaff({ ...newStaff, status: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  >
                    <option value="On Duty">On Duty</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone / Emergency Contact
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 012-3456"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-500/25 active:scale-95 transition"
                >
                  Confirm Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Staff Member</h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Role / Position *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assembly Specialist"
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Shift
                  </label>
                  <select
                    value={editingStaff.shift}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shift: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duty Status
                  </label>
                  <select
                    value={editingStaff.status}
                    onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  >
                    <option value="On Duty">On Duty</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone / Extension
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 012-3456"
                  value={editingStaff.phone}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-500/25 active:scale-95 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
