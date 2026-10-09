import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, Phone, Sun, Moon, Sunset, Trash2, 
  Search, X, Share2, Briefcase, ShieldCheck, CheckCircle2, 
  AlertTriangle, Database, Download, Upload, RotateCw, FileSpreadsheet,
  CheckSquare, MessageSquare, ClipboardCheck, Sparkles, Pencil,
  Square, Check, Filter, ArrowUpDown, Clock
} from 'lucide-react';
import { 
  getStaff, setStaff, getQualityInspections, setQualityInspections, 
  getHandovers, setHandovers, exportFullDatabase, importDatabase, clearAllData 
} from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';
import SelectionToolbar from '../components/SelectionToolbar';
import { useBackAction } from '../utils/backButton';

export default function FloorOps() {
  const [subTab, setSubTab] = useState('ROSTER'); // 'ROSTER' | 'QA' | 'HANDOVER' | 'BACKUP'
  const [staffList, setStaffList] = useState([]);
  const [qaList, setQaList] = useState([]);
  const [handovers, setHandoversList] = useState([]);

  // Multi-Selection States
  const [isStaffSelectMode, setIsStaffSelectMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);

  const [isQaSelectMode, setIsQaSelectMode] = useState(false);
  const [selectedQaIds, setSelectedQaIds] = useState([]);

  const [isHandoverSelectMode, setIsHandoverSelectMode] = useState(false);
  const [selectedHandoverIds, setSelectedHandoverIds] = useState([]);

  // Filters & Search for Staff
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL'); // 'ALL' | 'On Duty' | 'Off Duty'
  const [staffShiftFilter, setStaffShiftFilter] = useState('ALL'); // 'ALL' | 'Morning' | 'Day' | 'Night'
  const [staffDeptFilter, setStaffDeptFilter] = useState('ALL'); // 'ALL' | 'Assembly' | 'Machining' | 'Quality Control' | 'Maintenance' | 'Warehouse & Logistics'

  // Filters & Search for QA
  const [qaSearch, setQaSearch] = useState('');
  const [qaStatusFilter, setQaStatusFilter] = useState('ALL'); // 'ALL' | 'Passed' | 'Flagged' | 'Rejected'
  const [qaSortBy, setQaSortBy] = useState('DATE_DESC');

  // Bulk Modals
  const [showBulkStaffShiftModal, setShowBulkStaffShiftModal] = useState(false);
  const [bulkStaffShiftValue, setBulkStaffShiftValue] = useState('Morning');

  const [showBulkStaffDeptModal, setShowBulkStaffDeptModal] = useState(false);
  const [bulkStaffDeptValue, setBulkStaffDeptValue] = useState('Assembly');

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddQaModal, setShowAddQaModal] = useState(false);
  const [showAddHandoverModal, setShowAddHandoverModal] = useState(false);

  // Edit Modals & States
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingQa, setEditingQa] = useState(null);
  const [editingHandover, setEditingHandover] = useState(null);

  // Hardware Back Button Handlers
  const isAnyModalOpen = showAddStaffModal || showAddQaModal || showAddHandoverModal || 
    !!editingStaff || !!editingQa || !!editingHandover || 
    showBulkStaffShiftModal || showBulkStaffDeptModal;

  useBackAction(() => {
    if (showAddStaffModal) { setShowAddStaffModal(false); return true; }
    if (showAddQaModal) { setShowAddQaModal(false); return true; }
    if (showAddHandoverModal) { setShowAddHandoverModal(false); return true; }
    if (editingStaff) { setEditingStaff(null); return true; }
    if (editingQa) { setEditingQa(null); return true; }
    if (editingHandover) { setEditingHandover(null); return true; }
    if (showBulkStaffShiftModal) { setShowBulkStaffShiftModal(false); return true; }
    if (showBulkStaffDeptModal) { setShowBulkStaffDeptModal(false); return true; }
    return false;
  }, isAnyModalOpen, 90);

  useBackAction(() => {
    if (isStaffSelectMode) { setIsStaffSelectMode(false); setSelectedStaffIds([]); return true; }
    if (isQaSelectMode) { setIsQaSelectMode(false); setSelectedQaIds([]); return true; }
    return false;
  }, isStaffSelectMode || isQaSelectMode, 80);

  // Trace back to main ROSTER tab before leaving page
  useBackAction(() => {
    if (subTab !== 'ROSTER') {
      triggerHaptic('light');
      setSubTab('ROSTER');
      return true;
    }
    return false;
  }, subTab !== 'ROSTER', 70);

  // Device clock live current shift
  const getCurrentShift = () => {
    const hr = new Date().getHours();
    if (hr >= 6 && hr < 14) return 'Morning';
    if (hr >= 14 && hr < 22) return 'Day';
    return 'Night';
  };

  // Forms
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    department: 'Assembly',
    shift: 'Morning',
    status: 'On Duty',
    phone: ''
  });

  const [newQa, setNewQa] = useState({
    batch: '',
    inspectedQty: '',
    passedQty: '',
    defectQty: 0,
    defectCategory: 'Zero Defects',
    inspector: '',
    status: 'Passed',
    notes: ''
  });

  const [newHandover, setNewHandover] = useState({
    shiftFrom: 'Morning',
    shiftTo: 'Day',
    supervisor: '',
    notes: '',
    safetyIssues: 'Zero incidents',
    criticalTasks: ''
  });

  const loadData = async () => {
    try {
      const s = await getStaff();
      const q = await getQualityInspections();
      const h = await getHandovers();
      setStaffList(Array.isArray(s) ? s : []);
      setQaList(Array.isArray(q) ? q : []);
      setHandoversList(Array.isArray(h) ? h : []);
      setNewStaff(prev => ({ ...prev, shift: getCurrentShift() }));
      setNewHandover(prev => ({ ...prev, shiftFrom: getCurrentShift() }));
    } catch (err) {
      console.error('Error loading floor ops data:', err);
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

  // Staff functions
  const handleToggleStatus = async (id) => {
    await triggerHaptic('light');
    const updated = staffList.map(member => {
      if (member && member.id === id) {
        const next = member.status === 'On Duty' ? 'Off Duty' : 'On Duty';
        return { ...member, status: next };
      }
      return member;
    });
    setStaffList(updated);
    await setStaff(updated);
    await showToast('Shift status updated');
  };

  const handleRemoveStaff = async (id, name) => {
    if (window.confirm(`Remove ${name || 'this member'} from floor roster?`)) {
      await triggerHaptic('heavy');
      const updated = staffList.filter(s => s && s.id !== id);
      setStaffList(updated);
      await setStaff(updated);
      await showToast('Staff member removed');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.role) return;

    await triggerHaptic('success');
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-amber-500 to-orange-600'
    ];
    const entry = {
      id: Date.now(),
      name: newStaff.name.trim(),
      role: newStaff.role.trim(),
      department: newStaff.department,
      shift: newStaff.shift,
      status: newStaff.status || 'On Duty',
      phone: (newStaff.phone || '').trim() || '+1 (555) 000-0000',
      avatarColor: gradients[Math.floor(Math.random() * gradients.length)]
    };

    const updated = [entry, ...staffList];
    setStaffList(updated);
    await setStaff(updated);
    setShowAddStaffModal(false);
    setNewStaff({ name: '', role: '', department: 'Assembly', shift: 'Morning', status: 'On Duty', phone: '' });
    await showToast('Staff member onboarded!');
  };

  const handleStartEditStaff = (member) => {
    triggerHaptic('light');
    setEditingStaff({
      ...member,
      name: member.name || '',
      role: member.role || '',
      department: member.department || 'Assembly',
      shift: member.shift || 'Morning',
      status: member.status || 'On Duty',
      phone: member.phone || ''
    });
  };

  const handleSaveEditStaff = async (e) => {
    e.preventDefault();
    if (!editingStaff.name.trim() || !editingStaff.role.trim()) {
      await showToast('Please enter staff name and role');
      return;
    }
    await triggerHaptic('success');
    const updated = staffList.map(s => {
      if (s.id === editingStaff.id) {
        return {
          ...s,
          name: editingStaff.name.trim(),
          role: editingStaff.role.trim(),
          department: editingStaff.department,
          shift: editingStaff.shift,
          status: editingStaff.status,
          phone: (editingStaff.phone || '').trim() || '+1 (555) 000-0000'
        };
      }
      return s;
    });
    setStaffList(updated);
    await setStaff(updated);
    setEditingStaff(null);
    await showToast(`Staff member "${editingStaff.name}" updated!`);
  };

  // QA functions
  const handleAddQa = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const inspected = Number(newQa.inspectedQty) || 1;
    const passed = Number(newQa.passedQty) || 0;
    const def = Math.max(0, inspected - passed);
    const passRate = Math.round((passed / inspected) * 100);

    const entry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      batch: newQa.batch.trim(),
      inspectedQty: inspected,
      passedQty: passed,
      defectQty: def,
      defectCategory: newQa.defectCategory,
      inspector: newQa.inspector.trim() || 'QA Inspector',
      status: passRate >= 95 ? 'Passed' : passRate >= 80 ? 'Flagged' : 'Rejected',
      notes: newQa.notes.trim()
    };

    const updated = [entry, ...qaList];
    setQaList(updated);
    await setQualityInspections(updated);
    setShowAddQaModal(false);
    setNewQa({
      batch: '',
      inspectedQty: '',
      passedQty: '',
      defectQty: 0,
      defectCategory: 'Zero Defects',
      inspector: '',
      status: 'Passed',
      notes: ''
    });
    await showToast(`QA Logged: ${passRate}% Pass Rate (${entry.status})`);
  };

  const handleStartEditQa = (qa) => {
    triggerHaptic('light');
    setEditingQa({
      ...qa,
      batch: qa.batch || '',
      inspectedQty: qa.inspectedQty || 1,
      passedQty: qa.passedQty !== undefined ? qa.passedQty : 0,
      defectCategory: qa.defectCategory || 'Zero Defects',
      inspector: qa.inspector || '',
      status: qa.status || 'Passed',
      notes: qa.notes || ''
    });
  };

  const handleSaveEditQa = async (e) => {
    e.preventDefault();
    if (!editingQa.batch.trim()) {
      await showToast('Please enter batch identifier');
      return;
    }
    await triggerHaptic('success');
    const inspected = Number(editingQa.inspectedQty) || 1;
    const passed = Number(editingQa.passedQty) || 0;
    const def = Math.max(0, inspected - passed);
    const passRate = Math.round((passed / inspected) * 100);

    const updated = qaList.map(q => {
      if (q.id === editingQa.id) {
        return {
          ...q,
          batch: editingQa.batch.trim(),
          inspectedQty: inspected,
          passedQty: passed,
          defectQty: def,
          defectCategory: editingQa.defectCategory,
          inspector: editingQa.inspector.trim() || 'QA Inspector',
          status: editingQa.status || (passRate >= 95 ? 'Passed' : passRate >= 80 ? 'Flagged' : 'Rejected'),
          notes: (editingQa.notes || '').trim()
        };
      }
      return q;
    });

    setQaList(updated);
    await setQualityInspections(updated);
    setEditingQa(null);
    await showToast(`QA inspection for batch ${editingQa.batch} updated!`);
  };

  const handleRemoveQa = async (id, batch) => {
    if (window.confirm(`Delete QA inspection record for ${batch}?`)) {
      await triggerHaptic('heavy');
      const updated = qaList.filter(q => q.id !== id);
      setQaList(updated);
      await setQualityInspections(updated);
      await showToast('QA record deleted');
    }
  };

  // Handover functions
  const handleAddHandover = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');

    const entry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      shiftFrom: newHandover.shiftFrom,
      shiftTo: newHandover.shiftTo,
      supervisor: newHandover.supervisor.trim() || 'Shift Lead',
      notes: newHandover.notes.trim(),
      safetyIssues: newHandover.safetyIssues.trim() || 'None',
      criticalTasks: newHandover.criticalTasks.trim()
    };

    const updated = [entry, ...handovers];
    setHandoversList(updated);
    await setHandovers(updated);
    setShowAddHandoverModal(false);
    setNewHandover({
      shiftFrom: 'Morning',
      shiftTo: 'Day',
      supervisor: '',
      notes: '',
      safetyIssues: 'Zero incidents',
      criticalTasks: ''
    });
    await showToast('Shift handover logged in register!');
  };

  const handleStartEditHandover = (h) => {
    triggerHaptic('light');
    setEditingHandover({
      ...h,
      shiftFrom: h.shiftFrom || 'Morning',
      shiftTo: h.shiftTo || 'Day',
      supervisor: h.supervisor || '',
      notes: h.notes || '',
      safetyIssues: h.safetyIssues || 'Zero incidents',
      criticalTasks: h.criticalTasks || ''
    });
  };

  const handleSaveEditHandover = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = handovers.map(h => {
      if (h.id === editingHandover.id) {
        return {
          ...h,
          shiftFrom: editingHandover.shiftFrom,
          shiftTo: editingHandover.shiftTo,
          supervisor: editingHandover.supervisor.trim() || 'Shift Lead',
          notes: editingHandover.notes.trim(),
          safetyIssues: editingHandover.safetyIssues.trim() || 'Zero incidents',
          criticalTasks: editingHandover.criticalTasks.trim()
        };
      }
      return h;
    });

    setHandoversList(updated);
    await setHandovers(updated);
    setEditingHandover(null);
    await showToast('Shift handover updated!');
  };

  const handleRemoveHandover = async (id) => {
    if (window.confirm('Delete this shift handover record?')) {
      await triggerHaptic('heavy');
      const updated = handovers.filter(h => h.id !== id);
      setHandoversList(updated);
      await setHandovers(updated);
      await showToast('Handover log deleted');
    }
  };

  // Multi-Selection Handlers for Staff
  const toggleSelectStaff = (id) => {
    triggerHaptic('light');
    setSelectedStaffIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllStaff = () => {
    triggerHaptic('light');
    setSelectedStaffIds(filteredStaff.map(s => s.id));
  };

  const handleDeselectAllStaff = () => {
    triggerHaptic('light');
    setSelectedStaffIds([]);
  };

  const handleBulkSetDuty = async (statusVal) => {
    await triggerHaptic('success');
    const updated = staffList.map(s => {
      if (selectedStaffIds.includes(s.id)) {
        return { ...s, status: statusVal };
      }
      return s;
    });
    setStaffList(updated);
    await setStaff(updated);
    await showToast(`Updated ${selectedStaffIds.length} staff to ${statusVal}!`);
    setSelectedStaffIds([]);
  };

  const handleBulkReassignStaffShift = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = staffList.map(s => {
      if (selectedStaffIds.includes(s.id)) {
        return { ...s, shift: bulkStaffShiftValue };
      }
      return s;
    });
    setStaffList(updated);
    await setStaff(updated);
    setShowBulkStaffShiftModal(false);
    await showToast(`Reassigned ${selectedStaffIds.length} staff to ${bulkStaffShiftValue} shift!`);
    setSelectedStaffIds([]);
  };

  const handleBulkReassignStaffDept = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = staffList.map(s => {
      if (selectedStaffIds.includes(s.id)) {
        return { ...s, department: bulkStaffDeptValue };
      }
      return s;
    });
    setStaffList(updated);
    await setStaff(updated);
    setShowBulkStaffDeptModal(false);
    await showToast(`Reassigned ${selectedStaffIds.length} staff to ${bulkStaffDeptValue}!`);
    setSelectedStaffIds([]);
  };

  const handleBulkDeleteStaff = async () => {
    if (window.confirm(`Remove ${selectedStaffIds.length} selected staff members from roster?`)) {
      await triggerHaptic('heavy');
      const updated = staffList.filter(s => !selectedStaffIds.includes(s.id));
      setStaffList(updated);
      await setStaff(updated);
      setSelectedStaffIds([]);
      await showToast(`Removed ${selectedStaffIds.length} staff members.`);
    }
  };

  // Multi-Selection Handlers for QA
  const toggleSelectQa = (id) => {
    triggerHaptic('light');
    setSelectedQaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllQa = () => {
    triggerHaptic('light');
    setSelectedQaIds(filteredQa.map(q => q.id));
  };

  const handleDeselectAllQa = () => {
    triggerHaptic('light');
    setSelectedQaIds([]);
  };

  const handleBulkSetQaStatus = async (statusVal) => {
    await triggerHaptic('success');
    const updated = qaList.map(q => {
      if (selectedQaIds.includes(q.id)) {
        return { ...q, status: statusVal };
      }
      return q;
    });
    setQaList(updated);
    await setQualityInspections(updated);
    await showToast(`Marked ${selectedQaIds.length} QA records as "${statusVal}"!`);
    setSelectedQaIds([]);
  };

  const handleBulkExportQa = async () => {
    await triggerHaptic('light');
    const selected = qaList.filter(q => selectedQaIds.includes(q.id));
    const jsonStr = JSON.stringify(selected, null, 2);
    await shareOrCopy({
      title: 'QA Inspections Export',
      text: `Quality inspection records for ${selected.length} batches.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDeleteQa = async () => {
    if (window.confirm(`Delete ${selectedQaIds.length} selected QA inspection records?`)) {
      await triggerHaptic('heavy');
      const updated = qaList.filter(q => !selectedQaIds.includes(q.id));
      setQaList(updated);
      await setQualityInspections(updated);
      setSelectedQaIds([]);
      await showToast(`Deleted ${selectedQaIds.length} QA records.`);
    }
  };

  // Filtered & Sorted Staff Memo
  const filteredStaff = useMemo(() => {
    let list = Array.isArray(staffList) ? [...staffList] : [];
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q))
      );
    }
    if (staffStatusFilter !== 'ALL') {
      list = list.filter(s => s.status === staffStatusFilter);
    }
    if (staffShiftFilter !== 'ALL') {
      list = list.filter(s => s.shift === staffShiftFilter);
    }
    if (staffDeptFilter !== 'ALL') {
      list = list.filter(s => s.department === staffDeptFilter);
    }
    return list;
  }, [staffList, staffSearch, staffStatusFilter, staffShiftFilter, staffDeptFilter]);

  // Filtered & Sorted QA Memo
  const filteredQa = useMemo(() => {
    let list = Array.isArray(qaList) ? [...qaList] : [];
    if (qaSearch.trim()) {
      const q = qaSearch.toLowerCase();
      list = list.filter(qa =>
        (qa.batch && qa.batch.toLowerCase().includes(q)) ||
        (qa.inspector && qa.inspector.toLowerCase().includes(q)) ||
        (qa.defectCategory && qa.defectCategory.toLowerCase().includes(q))
      );
    }
    if (qaStatusFilter !== 'ALL') {
      list = list.filter(qa => qa.status === qaStatusFilter);
    }
    if (qaSortBy === 'DATE_DESC') {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (qaSortBy === 'DATE_ASC') {
      list.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (qaSortBy === 'DEFECT_DESC') {
      list.sort((a, b) => (Number(b.defectQty) || 0) - (Number(a.defectQty) || 0));
    } else if (qaSortBy === 'PASS_DESC') {
      list.sort((a, b) => (Number(b.passedQty) || 0) - (Number(a.passedQty) || 0));
    }
    return list;
  }, [qaList, qaSearch, qaStatusFilter, qaSortBy]);

  // Enterprise Backup & Restore
  const handleExportBackup = async () => {
    await triggerHaptic('medium');
    const db = await exportFullDatabase();
    const jsonStr = JSON.stringify(db, null, 2);
    await shareOrCopy({
      title: 'Factory Operations Enterprise Backup',
      text: `Full manufacturing database snapshot exported on ${new Date().toLocaleString()}.`,
      jsonString: jsonStr
    });
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (window.confirm('Restore database from this backup file? Existing data will be updated.')) {
        await importDatabase(parsed);
        await triggerHaptic('success');
        await showToast('Database successfully restored!');
        window.location.reload();
      }
    } catch (err) {
      alert('Failed to import backup: ' + err.message);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Floor Operations</h2>
          <p className="text-xs text-slate-500 font-medium">Quality assurance, staff roster, handovers & backups</p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-4 p-1 bg-slate-200/80 rounded-2xl text-[11px] font-bold">
        <button
          onClick={() => { triggerHaptic('light'); setSubTab('ROSTER'); }}
          className={`py-2 rounded-xl transition flex flex-col items-center ${
            subTab === 'ROSTER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <span>Roster</span>
          <span className="text-[9px] opacity-60">({staffList.length})</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setSubTab('QA'); }}
          className={`py-2 rounded-xl transition flex flex-col items-center ${
            subTab === 'QA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <span>Quality QA</span>
          <span className="text-[9px] opacity-60">({qaList.length})</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setSubTab('HANDOVER'); }}
          className={`py-2 rounded-xl transition flex flex-col items-center ${
            subTab === 'HANDOVER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <span>Handovers</span>
          <span className="text-[9px] opacity-60">({handovers.length})</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setSubTab('BACKUP'); }}
          className={`py-2 rounded-xl transition flex flex-col items-center ${
            subTab === 'BACKUP' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <span>Data Ops</span>
          <span className="text-[9px] opacity-60">Backup</span>
        </button>
      </div>

      {/* SUB-TAB 1: STAFF ROSTER */}
      {subTab === 'ROSTER' && (
        <div className="space-y-3">
          {/* Roster Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">
                Shop Floor Crew ({staffList.filter(s => s.status === 'On Duty').length} of {staffList.length} On Duty)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setIsStaffSelectMode(!isStaffSelectMode);
                  if (isStaffSelectMode) setSelectedStaffIds([]);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition ${
                  isStaffSelectMode
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CheckSquare size={13} />
                <span>{isStaffSelectMode ? 'Done' : 'Select'}</span>
              </button>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddStaffModal(true); }}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center space-x-1 shadow-md shadow-purple-500/20 active:scale-95 transition"
              >
                <UserPlus size={14} />
                <span>Onboard</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, role, department..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
              />
              {staffSearch && (
                <button
                  onClick={() => setStaffSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {[
                { id: 'ALL', label: 'All Crew', count: staffList.length },
                { id: 'On Duty', label: '🟢 On Duty', count: staffList.filter(s => s.status === 'On Duty').length },
                { id: 'Off Duty', label: '⚪ Off Duty', count: staffList.filter(s => s.status === 'Off Duty').length },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => { triggerHaptic('light'); setStaffStatusFilter(st.id); }}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center space-x-1 ${
                    staffStatusFilter === st.id
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    staffStatusFilter === st.id ? 'bg-purple-700 text-purple-100' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {st.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Shift & Department Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[10px] pt-1 border-t border-slate-100">
              <span className="text-slate-400 font-bold shrink-0">Shift:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'Morning', label: '☀️ Morning' },
                { id: 'Day', label: '🌅 Day' },
                { id: 'Night', label: '🌙 Night' },
              ].map(sh => (
                <button
                  key={sh.id}
                  onClick={() => { triggerHaptic('light'); setStaffShiftFilter(sh.id); }}
                  className={`px-2 py-0.5 rounded-md font-bold shrink-0 transition ${
                    staffShiftFilter === sh.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {sh.label}
                </button>
              ))}

              <span className="text-slate-300 font-bold shrink-0 px-1">|</span>

              <span className="text-slate-400 font-bold shrink-0">Dept:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'Assembly', label: 'Assembly' },
                { id: 'Machining', label: 'Machining' },
                { id: 'Quality Control', label: 'QA' },
                { id: 'Maintenance', label: 'Maintenance' },
              ].map(dp => (
                <button
                  key={dp.id}
                  onClick={() => { triggerHaptic('light'); setStaffDeptFilter(dp.id); }}
                  className={`px-2 py-0.5 rounded-md font-bold shrink-0 transition ${
                    staffDeptFilter === dp.id
                      ? 'bg-purple-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {dp.label}
                </button>
              ))}
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Staff Members Found</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {staffSearch || staffStatusFilter !== 'ALL' || staffShiftFilter !== 'ALL' || staffDeptFilter !== 'ALL'
                    ? 'Try clearing search or filter parameters.'
                    : 'Onboard floor supervisors, CNC operators, technicians, and QA staff.'}
                </p>
              </div>
              {staffList.length === 0 && (
                <button
                  onClick={() => { triggerHaptic('light'); setShowAddStaffModal(true); }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition"
                >
                  <UserPlus size={15} />
                  <span>Onboard First Staff Member</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredStaff.map((member) => {
                const isOnDuty = member.status === 'On Duty';
                const initial = ((member.name || 'S').trim().charAt(0) || 'S').toUpperCase();
                const isSelected = selectedStaffIds.includes(member.id);

                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      if (isStaffSelectMode) toggleSelectStaff(member.id);
                    }}
                    className={`bg-white p-4 rounded-2xl border transition shadow-xs relative ${
                      isStaffSelectMode ? 'cursor-pointer active:scale-[0.99]' : ''
                    } ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {isStaffSelectMode && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectStaff(member.id);
                            }}
                            className="shrink-0 mr-0.5"
                          >
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                                <Check size={13} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                            )}
                          </div>
                        )}

                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${member.avatarColor || 'from-purple-500 to-indigo-600'} text-white font-black text-base flex items-center justify-center shrink-0`}>
                          {initial}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                          <p className="text-xs text-purple-700 font-semibold">{member.role} • {member.department || 'Floor'}</p>
                        </div>
                      </div>

                      {!isStaffSelectMode && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEditStaff(member); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition"
                            title="Edit Staff Member"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveStaff(member.id, member.name); }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Remove Staff"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-slate-500">
                        <span className="font-medium">{member.shift} Shift</span>
                        {member.phone && (
                          <span className="text-[11px] text-slate-400">• {member.phone}</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(member.id);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 active:scale-95 transition ${
                          isOnDuty ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{member.status}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Staff Bulk Selection Toolbar */}
          {isStaffSelectMode && (
            <SelectionToolbar
              selectedCount={selectedStaffIds.length}
              totalCount={filteredStaff.length}
              onSelectAll={handleSelectAllStaff}
              onDeselectAll={handleDeselectAllStaff}
              onClose={() => {
                setIsStaffSelectMode(false);
                setSelectedStaffIds([]);
              }}
              actions={[
                {
                  label: 'On Duty',
                  icon: CheckCircle2,
                  onClick: () => handleBulkSetDuty('On Duty'),
                  color: 'emerald'
                },
                {
                  label: 'Off Duty',
                  icon: X,
                  onClick: () => handleBulkSetDuty('Off Duty'),
                  color: 'slate'
                },
                {
                  label: 'Shift',
                  icon: Clock,
                  onClick: () => setShowBulkStaffShiftModal(true),
                  color: 'indigo'
                },
                {
                  label: 'Dept',
                  icon: Briefcase,
                  onClick: () => setShowBulkStaffDeptModal(true),
                  color: 'purple'
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  onClick: handleBulkDeleteStaff,
                  color: 'red'
                }
              ]}
            />
          )}
        </div>
      )}

      {/* SUB-TAB 2: QUALITY ASSURANCE & DEFECT SCRAP */}
      {subTab === 'QA' && (
        <div className="space-y-3">
          {/* QA Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Quality Inspection Logs ({qaList.filter(q => q.status === 'Passed').length} Passed)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setIsQaSelectMode(!isQaSelectMode);
                  if (isQaSelectMode) setSelectedQaIds([]);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition ${
                  isQaSelectMode
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CheckSquare size={13} />
                <span>{isQaSelectMode ? 'Done' : 'Select'}</span>
              </button>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddQaModal(true); }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center space-x-1 shadow-md shadow-blue-500/20 active:scale-95 transition"
              >
                <ClipboardCheck size={14} />
                <span>Log Inspection</span>
              </button>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search QA by batch, inspector, defect..."
                  value={qaSearch}
                  onChange={(e) => setQaSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
                {qaSearch && (
                  <button
                    onClick={() => setQaSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={qaSortBy}
                  onChange={(e) => { triggerHaptic('light'); setQaSortBy(e.target.value); }}
                  className="py-2 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DATE_DESC">Date: Newest</option>
                  <option value="DATE_ASC">Date: Oldest</option>
                  <option value="DEFECT_DESC">Most Defective</option>
                  <option value="PASS_DESC">Most Passed</option>
                </select>
                <ArrowUpDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* QA Status Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {[
                { id: 'ALL', label: 'All Checks', count: qaList.length },
                { id: 'Passed', label: '🟢 Passed', count: qaList.filter(q => q.status === 'Passed').length },
                { id: 'Flagged', label: '🟡 Flagged', count: qaList.filter(q => q.status === 'Flagged').length },
                { id: 'Rejected', label: '🔴 Rejected', count: qaList.filter(q => q.status === 'Rejected').length },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => { triggerHaptic('light'); setQaStatusFilter(st.id); }}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center space-x-1 ${
                    qaStatusFilter === st.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    qaStatusFilter === st.id ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {st.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {filteredQa.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <ClipboardCheck size={36} className="mx-auto text-slate-300" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Quality Inspections Found</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {qaSearch || qaStatusFilter !== 'ALL'
                    ? 'No inspections matching the current filter.'
                    : 'Log sample audits, defect categories, and batch approvals.'}
                </p>
              </div>
              {qaList.length === 0 && (
                <button
                  onClick={() => { triggerHaptic('light'); setShowAddQaModal(true); }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
                >
                  <ClipboardCheck size={15} />
                  <span>Log First QA Inspection</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredQa.map((qa) => {
                const passPct = Math.round(((Number(qa.passedQty) || 0) / (Number(qa.inspectedQty) || 1)) * 100);
                const isPassed = qa.status === 'Passed';
                const isSelected = selectedQaIds.includes(qa.id);

                return (
                  <div
                    key={qa.id}
                    onClick={() => {
                      if (isQaSelectMode) toggleSelectQa(qa.id);
                    }}
                    className={`bg-white p-4 rounded-2xl border transition shadow-xs relative ${
                      isQaSelectMode ? 'cursor-pointer active:scale-[0.99]' : ''
                    } ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {isQaSelectMode && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectQa(qa.id);
                            }}
                            className="shrink-0 mt-0.5 mr-0.5"
                          >
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                                <Check size={13} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-900">{qa.batch}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              qa.status === 'Flagged' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {qa.status} ({passPct}% Pass)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Checked {qa.inspectedQty} units • <strong className="text-emerald-700">{qa.passedQty} Passed</strong> / <strong className="text-rose-600">{qa.defectQty} Defective</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="text-[11px] font-bold text-slate-400 mr-1">{qa.date}</span>
                        {!isQaSelectMode && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEditQa(qa); }}
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit QA Inspection"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveQa(qa.id, qa.batch); }}
                              className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete QA Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {qa.defectCategory && (
                      <div className="mt-2 text-xs bg-slate-50 p-2 rounded-xl text-slate-700 flex justify-between items-center">
                        <span>Defect Type: <strong>{qa.defectCategory}</strong></span>
                        <span className="text-[11px] text-slate-500">Inspector: {qa.inspector}</span>
                      </div>
                    )}
                    {qa.notes && <p className="text-[11px] text-slate-500 italic mt-1.5">"{qa.notes}"</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* QA Bulk Selection Toolbar */}
          {isQaSelectMode && (
            <SelectionToolbar
              selectedCount={selectedQaIds.length}
              totalCount={filteredQa.length}
              onSelectAll={handleSelectAllQa}
              onDeselectAll={handleDeselectAllQa}
              onClose={() => {
                setIsQaSelectMode(false);
                setSelectedQaIds([]);
              }}
              actions={[
                {
                  label: 'Pass All',
                  icon: CheckCircle2,
                  onClick: () => handleBulkSetQaStatus('Passed'),
                  color: 'emerald'
                },
                {
                  label: 'Flag All',
                  icon: AlertTriangle,
                  onClick: () => handleBulkSetQaStatus('Flagged'),
                  color: 'amber'
                },
                {
                  label: 'Export',
                  icon: Download,
                  onClick: handleBulkExportQa,
                  color: 'blue'
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  onClick: handleBulkDeleteQa,
                  color: 'red'
                }
              ]}
            />
          )}
        </div>
      )}

      {/* SUB-TAB 3: SHIFT HANDOVERS */}
      {subTab === 'HANDOVER' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Supervisor Shift Logbook</span>
            <button
              onClick={() => { triggerHaptic('light'); setShowAddHandoverModal(true); }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center space-x-1"
            >
              <MessageSquare size={14} />
              <span>Log Handover</span>
            </button>
          </div>

          {handovers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <MessageSquare size={36} className="mx-auto text-slate-300" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Shift Handovers Logged</h4>
                <p className="text-xs text-slate-500 mt-0.5">Record shift turnover notes, safety observations, and critical actions.</p>
              </div>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddHandoverModal(true); }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              >
                <MessageSquare size={15} />
                <span>Log First Shift Handover</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {handovers.map((h) => (
                <div key={h.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {h.shiftFrom} ➔ {h.shiftTo} Shift
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-400">{h.date}</span>
                      <button
                        onClick={() => handleStartEditHandover(h)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        title="Edit Shift Handover"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveHandover(h.id)}
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Handover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-800 font-medium">{h.notes}</p>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                    <span>Safety: <strong className="text-emerald-700">{h.safetyIssues}</strong></span>
                    <span>Supervisor: <strong>{h.supervisor}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: DATA OPS & BACKUP */}
      {subTab === 'BACKUP' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Database Backup & Sync</h3>
                <p className="text-xs text-slate-500">Full export, restoration, and disaster recovery</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleExportBackup}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition flex items-center justify-center space-x-2 shadow-md"
              >
                <Download size={16} />
                <span>Export & Share Full Database (JSON)</span>
              </button>

              <label className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm">
                <Upload size={16} className="text-blue-600" />
                <span>Restore Database from File (.json)</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>

              <button
                onClick={async () => {
                  if (window.confirm('Clear all stored production records and reset to clean slate?')) {
                    await clearAllData();
                    await showToast('Database erased - ready for live data');
                    window.location.reload();
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 active:scale-95 transition flex items-center justify-center space-x-1.5"
              >
                <RotateCw size={14} />
                <span>Wipe & Erase Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserPlus size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Onboard Floor Staff</h3>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Kane"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role / Job Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior CNC Operator"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Department Visual Selection Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Department / Cell</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Assembly', label: 'Assembly', icon: '🔧' },
                    { id: 'Machining', label: 'Machining', icon: '⚙️' },
                    { id: 'Quality Control', label: 'Quality Control', icon: '🔍' },
                    { id: 'Maintenance', label: 'Maintenance', icon: '🛠️' },
                    { id: 'Warehouse & Logistics', label: 'Warehouse', icon: '📦' },
                    { id: 'Operations', label: 'Operations', icon: '🏭' },
                  ].map(dept => {
                    const isSelected = newStaff.department === dept.id;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewStaff({ ...newStaff, department: dept.id }); }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center space-x-2 transition ${
                          isSelected
                            ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-sm">{dept.icon}</span>
                        <span className="truncate">{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift Segmented Cards */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Assigned Shift</label>
                  <span className="text-[10px] text-purple-600 font-bold">Plant Clock Active</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning', label: 'Morning', time: '06:00-14:00', icon: Sun },
                    { id: 'Day', label: 'Day', time: '14:00-22:00', icon: Sunset },
                    { id: 'Night', label: 'Night', time: '22:00-06:00', icon: Moon },
                  ].map(sh => {
                    const isCurrent = getCurrentShift() === sh.id;
                    const isSelected = newStaff.shift === sh.id;
                    const IconComp = sh.icon;

                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewStaff({ ...newStaff, shift: sh.id }); }}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center relative ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCurrent && (
                          <span className={`absolute -top-1.5 right-1 px-1 py-0.2 rounded-full text-[8px] font-black tracking-wider uppercase ${
                            isSelected ? 'bg-amber-400 text-slate-900' : 'bg-purple-600 text-white animate-pulse'
                          }`}>
                            LIVE
                          </span>
                        )}
                        <IconComp size={16} className={isSelected ? 'text-white' : 'text-slate-500'} />
                        <span className="text-xs font-bold mt-1">{sh.label}</span>
                        <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                          {sh.time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duty Status & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Initial Duty Status</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewStaff({ ...newStaff, status: 'On Duty' }); }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition ${
                        newStaff.status === 'On Duty'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      On Duty
                    </button>
                    <button
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewStaff({ ...newStaff, status: 'Off Duty' }); }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition ${
                        newStaff.status === 'Off Duty'
                          ? 'bg-slate-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Off Duty
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone / Ext</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-500/30 active:scale-95 transition"
                >
                  Confirm Staff Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log QA Inspection Modal */}
      {showAddQaModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ClipboardCheck size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Record QA Inspection</h3>
              </div>
              <button onClick={() => setShowAddQaModal(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddQa} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Batch / Order Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. Batch #A-101"
                  value={newQa.batch}
                  onChange={(e) => setNewQa({ ...newQa, batch: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Live Count and Pass Ratio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inspected Qty *</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={newQa.inspectedQty}
                    onChange={(e) => setNewQa({ ...newQa, inspectedQty: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Passed Qty *</label>
                  <input
                    type="number"
                    placeholder="e.g. 98"
                    value={newQa.passedQty}
                    onChange={(e) => setNewQa({ ...newQa, passedQty: e.target.value })}
                    required
                    min="0"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600"
                  />
                </div>
              </div>

              {/* Dynamic Live Pass Rate Banner */}
              {Number(newQa.inspectedQty) > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Computed Pass Rate</span>
                    <span className="text-base font-black text-slate-900">
                      {Math.round(((Number(newQa.passedQty) || 0) / (Number(newQa.inspectedQty) || 1)) * 100)}%
                    </span>
                  </div>
                  <div>
                    {Math.round(((Number(newQa.passedQty) || 0) / (Number(newQa.inspectedQty) || 1)) * 100) >= 95 ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 size={12} />
                        <span>Pass Grade (🟢)</span>
                      </span>
                    ) : Math.round(((Number(newQa.passedQty) || 0) / (Number(newQa.inspectedQty) || 1)) * 100) >= 80 ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                        <AlertTriangle size={12} />
                        <span>Flagged Grade (🟡)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                        <X size={12} />
                        <span>Reject Grade (🔴)</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Defect Category Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Primary Defect Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Zero Defects', label: 'Zero Defects', desc: '100% Quality pass', icon: '🛡️', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-900' },
                    { id: 'Surface Scratch', label: 'Surface Scratch', desc: 'Cosmetic blemish', icon: '✨', color: 'border-amber-500 bg-amber-50/40 text-amber-900' },
                    { id: 'Dimensional Variance', label: 'Dimensional Variance', desc: 'Tolerance mismatch', icon: '📐', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                    { id: 'Material Flaw', label: 'Material Flaw', desc: 'Porosity / weakness', icon: '🧪', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                    { id: 'Assembly Tolerance', label: 'Assembly Tolerance', desc: 'Fitment / clearance', icon: '⚙️', color: 'border-amber-500 bg-amber-50/40 text-amber-900' },
                    { id: 'Weld Defect', label: 'Weld Defect', desc: 'Incomplete weld', icon: '⚡', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                  ].map(cat => {
                    const isSelected = newQa.defectCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewQa({ ...newQa, defectCategory: cat.id }); }}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? `${cat.color} ring-1 ring-blue-500/30 font-bold shadow-2xs`
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span>{cat.icon}</span>
                          <span className="text-xs font-bold truncate">{cat.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inspector Quick Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inspector Name</label>
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none">
                  {staffList.filter(s => s.status === 'On Duty').map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewQa({ ...newQa, inspector: s.name }); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                        newQa.inspector === s.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={newQa.inspector}
                  onChange={(e) => setNewQa({ ...newQa, inspector: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inspection Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Batch meets ISO specifications"
                  value={newQa.notes}
                  onChange={(e) => setNewQa({ ...newQa, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
                >
                  Log QA Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Handover Modal */}
      {showAddHandoverModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquare size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Shift Handover Entry</h3>
              </div>
              <button onClick={() => setShowAddHandoverModal(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddHandover} className="space-y-4 mt-4">
              {/* Shift From & To Visual Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">From Shift</label>
                  <div className="space-y-1.5">
                    {['Morning', 'Day', 'Night'].map(sh => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewHandover({ ...newHandover, shiftFrom: sh }); }}
                        className={`w-full py-2 px-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                          newHandover.shiftFrom === sh
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sh}</span>
                        {getCurrentShift() === sh && (
                          <span className={`text-[9px] px-1 rounded ${newHandover.shiftFrom === sh ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                            NOW
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">To Shift</label>
                  <div className="space-y-1.5">
                    {['Day', 'Night', 'Morning'].map(sh => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewHandover({ ...newHandover, shiftTo: sh }); }}
                        className={`w-full py-2 px-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                          newHandover.shiftTo === sh
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sh}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supervisor / Lead</label>
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none">
                  {staffList.filter(s => s.status === 'On Duty').map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewHandover({ ...newHandover, supervisor: s.name }); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                        newHandover.supervisor === s.name
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newHandover.supervisor}
                  onChange={(e) => setNewHandover({ ...newHandover, supervisor: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Handover Briefing *</label>
                <textarea
                  rows="3"
                  placeholder="Summary of floor status, critical jobs, machine notes..."
                  value={newHandover.notes}
                  onChange={(e) => setNewHandover({ ...newHandover, notes: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Safety Incidents</label>
                <input
                  type="text"
                  placeholder="e.g. Zero incidents"
                  value={newHandover.safetyIssues}
                  onChange={(e) => setNewHandover({ ...newHandover, safetyIssues: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
                >
                  Save Handover Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Pencil size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Staff Member</h3>
              </div>
              <button onClick={() => setEditingStaff(null)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role / Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior CNC Operator"
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Visual Department Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Department</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Assembly', label: 'Assembly', icon: '🔧' },
                    { id: 'Machining', label: 'Machining', icon: '⚙️' },
                    { id: 'Quality Control', label: 'Quality Control', icon: '🔍' },
                    { id: 'Maintenance', label: 'Maintenance', icon: '🛠️' },
                    { id: 'Warehouse & Logistics', label: 'Warehouse', icon: '📦' },
                    { id: 'Operations', label: 'Operations', icon: '🏭' },
                  ].map(dept => {
                    const isSelected = editingStaff.department === dept.id;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingStaff({ ...editingStaff, department: dept.id }); }}
                        className={`p-2 rounded-xl border text-left text-xs font-bold flex items-center space-x-1.5 transition ${
                          isSelected
                            ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{dept.icon}</span>
                        <span className="truncate">{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Shift Segmented Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Assigned Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning', label: 'Morning', icon: Sun },
                    { id: 'Day', label: 'Day', icon: Sunset },
                    { id: 'Night', label: 'Night', icon: Moon },
                  ].map(sh => {
                    const isSelected = editingStaff.shift === sh.id;
                    const IconComp = sh.icon;

                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingStaff({ ...editingStaff, shift: sh.id }); }}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <IconComp size={16} className={isSelected ? 'text-white' : 'text-slate-500'} />
                        <span className="text-xs font-bold mt-1">{sh.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duty Status & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Duty Status</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { triggerHaptic('light'); setEditingStaff({ ...editingStaff, status: 'On Duty' }); }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition ${
                        editingStaff.status === 'On Duty'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      On Duty
                    </button>
                    <button
                      type="button"
                      onClick={() => { triggerHaptic('light'); setEditingStaff({ ...editingStaff, status: 'Off Duty' }); }}
                      className={`py-2 text-[11px] font-bold rounded-lg transition ${
                        editingStaff.status === 'Off Duty'
                          ? 'bg-slate-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Off Duty
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone / Ext</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 555-0192"
                    value={editingStaff.phone}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-500/30 active:scale-95 transition"
                >
                  Update Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit QA Modal */}
      {editingQa && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Pencil size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Quality Inspection</h3>
              </div>
              <button onClick={() => setEditingQa(null)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEditQa} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Batch / Order ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BATCH-2026-001"
                    value={editingQa.batch}
                    onChange={(e) => setEditingQa({ ...editingQa, batch: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inspector Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={editingQa.inspector}
                    onChange={(e) => setEditingQa({ ...editingQa, inspector: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sample Size (Inspected)</label>
                  <input
                    type="number"
                    value={editingQa.inspectedQty}
                    onChange={(e) => setEditingQa({ ...editingQa, inspectedQty: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Passed Quantity</label>
                  <input
                    type="number"
                    value={editingQa.passedQty}
                    onChange={(e) => setEditingQa({ ...editingQa, passedQty: e.target.value })}
                    required
                    min="0"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600"
                  />
                </div>
              </div>

              {/* Defect Category Visual Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Defect Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Zero Defects', label: 'Zero Defects', icon: '🛡️', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-900' },
                    { id: 'Surface Scratch', label: 'Surface Scratch', icon: '✨', color: 'border-amber-500 bg-amber-50/40 text-amber-900' },
                    { id: 'Dimensional Variance', label: 'Dimensional Variance', icon: '📐', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                    { id: 'Material Flaw', label: 'Material Flaw', icon: '🧪', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                    { id: 'Assembly Tolerance', label: 'Assembly Tolerance', icon: '⚙️', color: 'border-amber-500 bg-amber-50/40 text-amber-900' },
                    { id: 'Weld Defect', label: 'Weld Defect', icon: '⚡', color: 'border-rose-500 bg-rose-50/40 text-rose-900' },
                  ].map(cat => {
                    const isSelected = editingQa.defectCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingQa({ ...editingQa, defectCategory: cat.id }); }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center space-x-1.5 transition ${
                          isSelected
                            ? `${cat.color} ring-1 ring-blue-500/30 shadow-2xs`
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Verdict Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Status Verdict</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Passed', label: 'Passed', icon: CheckCircle2, color: 'bg-emerald-600 text-white border-emerald-600' },
                    { id: 'Flagged', label: 'Flagged', icon: AlertTriangle, color: 'bg-amber-500 text-white border-amber-500' },
                    { id: 'Rejected', label: 'Rejected', icon: X, color: 'bg-rose-600 text-white border-rose-600' },
                  ].map(verdict => {
                    const isSelected = editingQa.status === verdict.id;
                    const IconComp = verdict.icon;
                    return (
                      <button
                        key={verdict.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingQa({ ...editingQa, status: verdict.id }); }}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition ${
                          isSelected
                            ? `${verdict.color} shadow-2xs`
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <IconComp size={13} />
                        <span>{verdict.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes & Observations</label>
                <input
                  type="text"
                  placeholder="e.g. Within tolerance specifications"
                  value={editingQa.notes}
                  onChange={(e) => setEditingQa({ ...editingQa, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingQa(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
                >
                  Update QA Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Handover Modal */}
      {editingHandover && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Pencil size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Shift Handover</h3>
              </div>
              <button onClick={() => setEditingHandover(null)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEditHandover} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">From Shift</label>
                  <div className="space-y-1.5">
                    {['Morning', 'Day', 'Night'].map(sh => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingHandover({ ...editingHandover, shiftFrom: sh }); }}
                        className={`w-full py-2 px-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                          editingHandover.shiftFrom === sh
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sh}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">To Shift</label>
                  <div className="space-y-1.5">
                    {['Day', 'Night', 'Morning'].map(sh => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingHandover({ ...editingHandover, shiftTo: sh }); }}
                        className={`w-full py-2 px-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                          editingHandover.shiftTo === sh
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sh}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supervisor / Lead</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={editingHandover.supervisor}
                  onChange={(e) => setEditingHandover({ ...editingHandover, supervisor: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Handover Briefing *</label>
                <textarea
                  rows="3"
                  placeholder="Summary of floor status, critical jobs, machine notes..."
                  value={editingHandover.notes}
                  onChange={(e) => setEditingHandover({ ...editingHandover, notes: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Safety Incidents</label>
                <input
                  type="text"
                  placeholder="e.g. Zero incidents"
                  value={editingHandover.safetyIssues}
                  onChange={(e) => setEditingHandover({ ...editingHandover, safetyIssues: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Critical Follow-up Tasks</label>
                <input
                  type="text"
                  placeholder="e.g. Calibrate station 3 before batch 14"
                  value={editingHandover.criticalTasks || ''}
                  onChange={(e) => setEditingHandover({ ...editingHandover, criticalTasks: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingHandover(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
                >
                  Update Handover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Staff Shift Reassignment Modal */}
      {showBulkStaffShiftModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Clock size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Reassign Shift ({selectedStaffIds.length} Staff)
                </h3>
              </div>
              <button onClick={() => setShowBulkStaffShiftModal(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkReassignStaffShift} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select Target Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning', label: 'Morning', time: '06:00-14:00', icon: Sun },
                    { id: 'Day', label: 'Day', time: '14:00-22:00', icon: Sunset },
                    { id: 'Night', label: 'Night', time: '22:00-06:00', icon: Moon },
                  ].map(sh => {
                    const isSelected = bulkStaffShiftValue === sh.id;
                    const isCurrent = getCurrentShift() === sh.id;
                    const IconComp = sh.icon;

                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setBulkStaffShiftValue(sh.id); }}
                        className={`p-3 rounded-xl border text-center transition flex flex-col items-center relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCurrent && (
                          <span className={`absolute -top-1.5 right-1 px-1 py-0.2 rounded-full text-[8px] font-black uppercase ${
                            isSelected ? 'bg-amber-400 text-slate-900' : 'bg-indigo-600 text-white'
                          }`}>
                            LIVE
                          </span>
                        )}
                        <IconComp size={18} className={isSelected ? 'text-white' : 'text-slate-500'} />
                        <span className="text-xs font-bold mt-1">{sh.label}</span>
                        <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {sh.time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkStaffShiftModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
                >
                  Apply to {selectedStaffIds.length} Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Staff Department Reassignment Modal */}
      {showBulkStaffDeptModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Briefcase size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Reassign Department ({selectedStaffIds.length} Staff)
                </h3>
              </div>
              <button onClick={() => setShowBulkStaffDeptModal(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkReassignStaffDept} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select Target Department</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Assembly', label: 'Assembly', icon: '🔧' },
                    { id: 'Machining', label: 'Machining', icon: '⚙️' },
                    { id: 'Quality Control', label: 'Quality Control', icon: '🔍' },
                    { id: 'Maintenance', label: 'Maintenance', icon: '🛠️' },
                    { id: 'Warehouse & Logistics', label: 'Warehouse', icon: '📦' },
                    { id: 'Operations', label: 'Operations', icon: '🏭' },
                  ].map(dept => {
                    const isSelected = bulkStaffDeptValue === dept.id;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setBulkStaffDeptValue(dept.id); }}
                        className={`p-3 rounded-xl border text-left text-xs font-bold flex items-center space-x-2 transition ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-base">{dept.icon}</span>
                        <span className="truncate">{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkStaffDeptModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-500/30 active:scale-95 transition"
                >
                  Apply to {selectedStaffIds.length} Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
