import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, Plus, Search, Filter, CheckCircle2, Clock, 
  AlertTriangle, ArrowRight, Trash2, Share2, X, ChevronRight,
  Boxes, ShieldAlert, CheckSquare, Square, Layers, Sparkles, Pencil,
  Cpu, Users, User, ArrowUpDown, Play, Check, ShieldCheck
} from 'lucide-react';
import { 
  getWorkOrders, setWorkOrders, getMaterials, deductBOM, 
  getRecipes, getMachines, getStaff 
} from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';
import SelectionToolbar from '../components/SelectionToolbar';
import { useBackAction } from '../utils/backButton';

export default function WorkOrders() {
  const [orders, setOrdersList] = useState([]);
  const [materials, setMaterialsList] = useState([]);
  const [recipes, setRecipesList] = useState([]);
  const [machines, setMachinesList] = useState([]);
  const [staff, setStaffList] = useState([]);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [sortBy, setSortBy] = useState('DUE_ASC');

  // Multi-Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(null); // active order for progress update
  const [editingOrder, setEditingOrder] = useState(null); // active order being edited
  const [progressUnits, setProgressUnits] = useState('');

  // Bulk Modals
  const [showBulkPriorityModal, setShowBulkPriorityModal] = useState(false);
  const [bulkPriorityValue, setBulkPriorityValue] = useState('High');
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkStationValue, setBulkStationValue] = useState('');
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState('');

  // Hardware Back Button Handlers
  const isAnyModalOpen = showAddModal || !!showProgressModal || !!editingOrder || showBulkPriorityModal || showBulkAssignModal;

  useBackAction(() => {
    if (showAddModal) { setShowAddModal(false); return true; }
    if (showProgressModal) { setShowProgressModal(null); return true; }
    if (editingOrder) { setEditingOrder(null); return true; }
    if (showBulkPriorityModal) { setShowBulkPriorityModal(false); return true; }
    if (showBulkAssignModal) { setShowBulkAssignModal(false); return true; }
    return false;
  }, isAnyModalOpen, 90);

  useBackAction(() => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds([]);
      return true;
    }
    return false;
  }, isSelectMode, 80);

  const hasActiveFilters = searchQuery.trim() !== '' || filterStatus !== 'ALL' || filterPriority !== 'ALL';
  useBackAction(() => {
    if (hasActiveFilters) {
      setSearchQuery('');
      setFilterStatus('ALL');
      setFilterPriority('ALL');
      return true;
    }
    return false;
  }, hasActiveFilters, 70);

  // New Work Order Form State
  const [newOrder, setNewOrder] = useState({
    title: '',
    product: '',
    recipeId: '',
    quantity: '',
    priority: 'Normal',
    assignedStation: '',
    assignedTo: '',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    selectedMaterialId: '',
    qtyPerUnit: 1
  });

  const loadData = async () => {
    try {
      const ords = await getWorkOrders();
      const mats = await getMaterials();
      const recs = await getRecipes();
      const machs = await getMachines();
      const stf = await getStaff();

      setOrdersList(Array.isArray(ords) ? ords : []);
      setMaterialsList(Array.isArray(mats) ? mats : []);
      setRecipesList(Array.isArray(recs) ? recs : []);
      setMachinesList(Array.isArray(machs) ? machs : []);
      setStaffList(Array.isArray(stf) ? stf : []);

      if (mats && mats[0]) {
        setNewOrder(prev => ({ ...prev, selectedMaterialId: mats[0].id }));
      }
      if (machs && machs[0]) {
        setNewOrder(prev => ({ ...prev, assignedStation: machs[0].name }));
      }
      if (stf && stf[0]) {
        setNewOrder(prev => ({ ...prev, assignedTo: stf[0].name }));
      }
    } catch (err) {
      console.error('Error loading work orders:', err);
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
    setOrdersList(updated);
    await setWorkOrders(updated);
  };

  // Multi-Selection Handlers
  const toggleSelect = (id) => {
    triggerHaptic('light');
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    triggerHaptic('light');
    setSelectedIds(filteredOrders.map(o => o.id));
  };

  const handleDeselectAll = () => {
    triggerHaptic('light');
    setSelectedIds([]);
  };

  // Bulk Operations
  const handleBulkAdvanceStatus = async () => {
    await triggerHaptic('medium');
    const flow = ['Pending', 'In Progress', 'Quality Check', 'Completed'];
    const updated = orders.map(o => {
      if (selectedIds.includes(o.id)) {
        const currentIndex = flow.indexOf(o.status);
        const nextStatus = flow[Math.min(flow.length - 1, currentIndex + 1)];
        return {
          ...o,
          status: nextStatus,
          completedQty: nextStatus === 'Completed' ? o.quantity : o.completedQty
        };
      }
      return o;
    });

    await saveAndSync(updated);
    await showToast(`${selectedIds.length} Work Orders advanced to next stage!`);
    setSelectedIds([]);
  };

  const handleBulkSetPriority = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = orders.map(o => {
      if (selectedIds.includes(o.id)) {
        return { ...o, priority: bulkPriorityValue };
      }
      return o;
    });

    await saveAndSync(updated);
    setShowBulkPriorityModal(false);
    await showToast(`Priority updated to "${bulkPriorityValue}" for ${selectedIds.length} orders!`);
    setSelectedIds([]);
  };

  const handleBulkReassign = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = orders.map(o => {
      if (selectedIds.includes(o.id)) {
        return {
          ...o,
          assignedStation: bulkStationValue || o.assignedStation,
          assignedTo: bulkAssigneeValue || o.assignedTo
        };
      }
      return o;
    });

    await saveAndSync(updated);
    setShowBulkAssignModal(false);
    await showToast(`Reassigned ${selectedIds.length} orders!`);
    setSelectedIds([]);
  };

  const handleBulkExport = async () => {
    await triggerHaptic('medium');
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
    const jsonStr = JSON.stringify(selectedOrders, null, 2);
    await shareOrCopy({
      title: 'Export Selected Work Orders',
      text: `Dispatch manifest for ${selectedOrders.length} selected orders.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedIds.length} selected work orders permanently?`)) {
      await triggerHaptic('heavy');
      const updated = orders.filter(o => !selectedIds.includes(o.id));
      await saveAndSync(updated);
      setSelectedIds([]);
      await showToast(`${selectedIds.length} work orders deleted`);
    }
  };

  // Single Item Handlers
  const handleAdvanceStatus = async (orderId) => {
    await triggerHaptic('light');
    const flow = ['Pending', 'In Progress', 'Quality Check', 'Completed'];
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const currentIndex = flow.indexOf(o.status);
        const nextStatus = flow[Math.min(flow.length - 1, currentIndex + 1)];
        return { 
          ...o, 
          status: nextStatus, 
          completedQty: nextStatus === 'Completed' ? o.quantity : o.completedQty 
        };
      }
      return o;
    });
    await saveAndSync(updated);
    await showToast('Work Order advanced to next stage');
  };

  const handleLogProgress = async (e) => {
    e.preventDefault();
    if (!showProgressModal || !progressUnits || Number(progressUnits) <= 0) return;

    await triggerHaptic('medium');
    const addQty = Number(progressUnits);
    const targetOrder = showProgressModal;

    const bomResult = await deductBOM(targetOrder.id, addQty);
    const refreshedMats = await getMaterials();
    setMaterialsList(refreshedMats);

    const updated = orders.map(o => {
      if (o.id === targetOrder.id) {
        const nextCompleted = Math.min(o.quantity, (Number(o.completedQty) || 0) + addQty);
        const nextStatus = nextCompleted >= o.quantity ? 'Completed' : 'In Progress';
        return { ...o, completedQty: nextCompleted, status: nextStatus };
      }
      return o;
    });

    await saveAndSync(updated);
    setShowProgressModal(null);
    setProgressUnits('');

    if (bomResult && bomResult.summary && bomResult.summary.length > 0) {
      await showToast(`Progress logged! Raw materials auto-decreased: ${bomResult.summary.join(', ')}`);
    } else {
      await showToast(`Logged +${addQty} units produced on ${targetOrder.orderNumber}`);
    }
  };

  const handleStartEdit = (order) => {
    triggerHaptic('light');
    setEditingOrder({
      ...order,
      title: order.title || '',
      product: order.product || '',
      recipeId: order.recipeId || '',
      quantity: order.quantity || '',
      completedQty: order.completedQty || 0,
      priority: order.priority || 'Normal',
      status: order.status || 'Pending',
      assignedStation: order.assignedStation || '',
      assignedTo: order.assignedTo || '',
      dueDate: order.dueDate || new Date().toISOString().split('T')[0]
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingOrder.title || !editingOrder.product || !editingOrder.quantity) {
      await showToast('Please complete required fields');
      return;
    }

    await triggerHaptic('success');
    const selectedRecipe = recipes.find(r => r.id === editingOrder.recipeId);
    let bomList = editingOrder.bom || [];

    if (selectedRecipe && Array.isArray(selectedRecipe.ingredients)) {
      bomList = selectedRecipe.ingredients.map(ing => ({
        materialId: ing.materialId,
        name: ing.materialName || 'Material',
        qtyPerUnit: Number(ing.qtyPerUnit) || 1,
        unit: ing.unit || 'units'
      }));
    }

    const updated = orders.map(o => {
      if (o.id === editingOrder.id) {
        return {
          ...o,
          title: editingOrder.title.trim(),
          product: editingOrder.product.trim(),
          recipeId: editingOrder.recipeId || null,
          recipeName: selectedRecipe ? selectedRecipe.name : (editingOrder.recipeName || null),
          quantity: Number(editingOrder.quantity),
          completedQty: Math.min(Number(editingOrder.quantity), Number(editingOrder.completedQty) || 0),
          priority: editingOrder.priority,
          status: editingOrder.status,
          assignedStation: editingOrder.assignedStation,
          assignedTo: editingOrder.assignedTo,
          dueDate: editingOrder.dueDate,
          bom: bomList
        };
      }
      return o;
    });

    await saveAndSync(updated);
    setEditingOrder(null);
    await showToast(`Work Order ${editingOrder.orderNumber} updated!`);
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete Work Order "${title}"?`)) {
      await triggerHaptic('heavy');
      const updated = orders.filter(o => o.id !== id);
      await saveAndSync(updated);
      setSelectedIds(prev => prev.filter(x => x !== id));
      await showToast('Work Order removed');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newOrder.title || !newOrder.product || !newOrder.quantity) {
      await showToast('Please complete required fields');
      return;
    }

    await triggerHaptic('success');
    const orderNum = `WO-${Math.floor(8000 + Math.random() * 2000)}`;
    const selectedRecipe = recipes.find(r => r.id === newOrder.recipeId);
    let bomList = [];

    if (selectedRecipe && Array.isArray(selectedRecipe.ingredients)) {
      bomList = selectedRecipe.ingredients.map(ing => ({
        materialId: ing.materialId,
        name: ing.materialName || 'Material',
        qtyPerUnit: Number(ing.qtyPerUnit) || 1,
        unit: ing.unit || 'units'
      }));
    } else if (newOrder.selectedMaterialId) {
      const selectedMat = materials.find(m => m.id === newOrder.selectedMaterialId);
      if (selectedMat) {
        bomList = [{
          materialId: selectedMat.id,
          name: selectedMat.name,
          qtyPerUnit: Number(newOrder.qtyPerUnit) || 1,
          unit: selectedMat.unit
        }];
      }
    }

    const entry = {
      id: orderNum,
      orderNumber: orderNum,
      title: newOrder.title.trim(),
      product: newOrder.product.trim(),
      recipeId: newOrder.recipeId || null,
      recipeName: selectedRecipe ? selectedRecipe.name : null,
      quantity: Number(newOrder.quantity),
      completedQty: 0,
      priority: newOrder.priority,
      status: 'Pending',
      assignedStation: newOrder.assignedStation,
      assignedTo: newOrder.assignedTo,
      dueDate: newOrder.dueDate,
      bom: bomList
    };

    const updated = [entry, ...orders];
    await saveAndSync(updated);
    setShowAddModal(false);

    setNewOrder({
      title: '',
      product: '',
      recipeId: '',
      quantity: '',
      priority: 'Normal',
      assignedStation: machines[0]?.name || '',
      assignedTo: staff[0]?.name || '',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      selectedMaterialId: materials[0]?.id || '',
      qtyPerUnit: 1
    });

    await showToast(`Work Order ${orderNum} dispatched!`);
  };

  const handleExport = async () => {
    await triggerHaptic('light');
    const jsonStr = JSON.stringify(orders, null, 2);
    await shareOrCopy({
      title: 'Production Work Orders',
      text: `Dispatch list of ${orders.length} active and completed work orders.`,
      jsonString: jsonStr
    });
  };

  // Recipe Stock Sufficiency Check Helper
  const checkRecipeSufficiency = (recipe, targetUnits) => {
    if (!recipe || !Array.isArray(recipe.ingredients)) return { sufficient: true, shortages: [] };
    const units = Number(targetUnits) || 1;
    const shortages = [];

    for (const ing of recipe.ingredients) {
      const mat = materials.find(m => m.id === ing.materialId || (m.name && ing.materialName && m.name.toLowerCase() === ing.materialName.toLowerCase()));
      const available = mat ? Number(mat.quantity || 0) : 0;
      const required = (Number(ing.qtyPerUnit) || 1) * units;
      if (available < required) {
        shortages.push({
          name: mat ? mat.name : (ing.materialName || 'Material'),
          shortage: required - available,
          unit: ing.unit || 'units'
        });
      }
    }

    return {
      sufficient: shortages.length === 0,
      shortages
    };
  };

  // Filtered & Sorted Work Orders
  const filteredOrders = useMemo(() => {
    let result = (Array.isArray(orders) ? orders : []).filter(o => {
      if (!o) return false;
      const title = (o.title || '').toLowerCase();
      const prod = (o.product || '').toLowerCase();
      const num = (o.orderNumber || '').toLowerCase();
      const station = (o.assignedStation || '').toLowerCase();
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = title.includes(q) || prod.includes(q) || num.includes(q) || station.includes(q);
      if (!matchesSearch) return false;

      // Status Filter
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;

      // Priority Filter
      if (filterPriority !== 'ALL' && o.priority !== filterPriority) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'DUE_ASC') return (a.dueDate || '').localeCompare(b.dueDate || '');
      if (sortBy === 'DUE_DESC') return (b.dueDate || '').localeCompare(a.dueDate || '');
      if (sortBy === 'PROGRESS_DESC') {
        const pctA = Math.round(((Number(a.completedQty) || 0) / (Number(a.quantity) || 1)) * 100);
        const pctB = Math.round(((Number(b.completedQty) || 0) / (Number(b.quantity) || 1)) * 100);
        return pctB - pctA;
      }
      if (sortBy === 'QTY_DESC') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      return (b.orderNumber || '').localeCompare(a.orderNumber || '');
    });

    return result;
  }, [orders, searchQuery, filterStatus, filterPriority, sortBy]);

  // Bulk Actions Configuration for SelectionToolbar
  const bulkActions = [
    {
      label: 'Advance',
      icon: ArrowRight,
      variant: 'primary',
      onClick: handleBulkAdvanceStatus
    },
    {
      label: 'Priority',
      icon: ShieldAlert,
      variant: 'default',
      onClick: () => setShowBulkPriorityModal(true)
    },
    {
      label: 'Reassign',
      icon: Users,
      variant: 'default',
      onClick: () => {
        setBulkStationValue(machines[0]?.name || '');
        setBulkAssigneeValue(staff[0]?.name || '');
        setShowBulkAssignModal(true);
      }
    },
    {
      label: 'Export',
      icon: Share2,
      variant: 'default',
      onClick: handleBulkExport
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: handleBulkDelete
    }
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Work Orders</h2>
          <p className="text-xs text-slate-500 font-medium">Job dispatch, Recipe allocation & status flow</p>
        </div>
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Multi-Select Toggle Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds([]);
            }}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
              isSelectMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Selection Mode"
          >
            <CheckSquare size={16} />
            <span className="hidden sm:inline">{isSelectMode ? 'Exit Select' : 'Select'}</span>
          </button>

          <button
            onClick={handleExport}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm active:scale-95 transition flex items-center space-x-1 cursor-pointer"
          >
            <Share2 size={16} />
            <span className="text-xs font-bold hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => { triggerHaptic('light'); setShowAddModal(true); }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Advanced Search & Filtering Console */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center space-x-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by job title, model, WO#, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => { triggerHaptic('light'); setSortBy(e.target.value); }}
              className="py-2 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DUE_ASC">Due Date: Soonest</option>
              <option value="DUE_DESC">Due Date: Latest</option>
              <option value="PROGRESS_DESC">Progress % (High)</option>
              <option value="QTY_DESC">Quantity (High)</option>
            </select>
            <ArrowUpDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Status Filter Chips with Counts */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All Jobs', count: orders.length },
            { id: 'Pending', label: 'Pending', count: orders.filter(o => o.status === 'Pending').length },
            { id: 'In Progress', label: 'In Progress', count: orders.filter(o => o.status === 'In Progress').length },
            { id: 'Quality Check', label: 'Quality Check', count: orders.filter(o => o.status === 'Quality Check').length },
            { id: 'Completed', label: 'Completed', count: orders.filter(o => o.status === 'Completed').length },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => { triggerHaptic('light'); setFilterStatus(st.id); }}
              className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                filterStatus === st.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{st.label}</span>
              <span className="opacity-70">({st.count})</span>
            </button>
          ))}
        </div>

        {/* Priority Filter Row */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs border-t border-slate-100 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Priority:</span>
          {['ALL', 'Normal', 'High', 'Urgent'].map(pr => (
            <button
              key={pr}
              onClick={() => { triggerHaptic('light'); setFilterPriority(pr); }}
              className={`px-2.5 py-0.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                filterPriority === pr
                  ? pr === 'Urgent'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : pr === 'High'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {pr === 'ALL' ? 'All' : pr}
            </button>
          ))}
        </div>
      </div>

      {/* Select All Bar when in selection mode */}
      {isSelectMode && (
        <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-600">
          <button
            onClick={selectedIds.length === filteredOrders.length ? handleDeselectAll : handleSelectAll}
            className="text-blue-600 flex items-center space-x-1 hover:underline cursor-pointer"
          >
            {selectedIds.length === filteredOrders.length ? <CheckSquare size={15} /> : <Square size={15} />}
            <span>{selectedIds.length === filteredOrders.length ? 'Deselect All' : `Select All (${filteredOrders.length})`}</span>
          </button>
          <span>{selectedIds.length} of {filteredOrders.length} selected</span>
        </div>
      )}

      {/* Order Cards List */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const completed = Number(order.completedQty) || 0;
          const total = Number(order.quantity) || 1;
          const percent = Math.min(100, Math.round((completed / total) * 100));
          const isDone = order.status === 'Completed';
          const isSelected = selectedIds.includes(order.id);

          return (
            <div
              key={order.id}
              onClick={() => {
                if (isSelectMode) toggleSelect(order.id);
              }}
              className={`bg-white p-4 rounded-2xl border transition relative space-y-3 ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-md'
                  : 'border-slate-200/80 shadow-sm'
              } ${isSelectMode ? 'cursor-pointer' : ''}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2.5">
                  {(isSelectMode || selectedIds.length > 0) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(order.id);
                      }}
                      className="mt-0.5 p-0.5 rounded text-blue-600 cursor-pointer"
                    >
                      {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-slate-300" />}
                    </button>
                  )}

                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-[10px] font-black tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {order.orderNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        order.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        order.status === 'Quality Check' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {order.status}
                      </span>
                      {order.recipeName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center">
                          <Layers size={10} className="mr-1 text-indigo-600" /> Recipe: {order.recipeName}
                        </span>
                      )}
                      {order.priority !== 'Normal' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          order.priority === 'Urgent' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {order.priority}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{order.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{order.product}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleStartEdit(order)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    title="Edit Work Order"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(order.id, order.title)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete Order"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Progress Bar & Units */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold text-slate-600">
                  <span>Output: <strong className="text-slate-900">{completed}</strong> / {total} units</span>
                  <span>{percent}% Completed</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    style={{ width: `${percent}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  />
                </div>
              </div>

              {/* Floor Details: Station, Assignee, BOM summary */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center"><Cpu size={12} className="mr-1 text-slate-400" /> Station: <strong className="text-slate-700 ml-1">{order.assignedStation || 'Line 1'}</strong></span>
                  <span className="flex items-center"><User size={12} className="mr-1 text-slate-400" /> Lead: <strong className="text-slate-700 ml-1">{order.assignedTo || 'Staff'}</strong></span>
                  <span className="flex items-center"><Clock size={12} className="mr-1 text-slate-400" /> Due: <strong className="text-slate-700 ml-1">{order.dueDate}</strong></span>
                </div>

                {order.bom && order.bom.length > 0 && (
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center">
                    <Boxes size={12} className="mr-1" /> {order.bom.length} BOM Items Auto-Deducted
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                {!isDone && (
                  <>
                    <button
                      onClick={() => setShowProgressModal(order)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Layers size={13} />
                      <span>Log Output & Deduct BOM</span>
                    </button>
                    <button
                      onClick={() => handleAdvanceStatus(order.id)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold active:scale-95 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Advance</span>
                      <ArrowRight size={13} />
                    </button>
                  </>
                )}
                {isDone && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center py-1">
                    <CheckCircle2 size={14} className="mr-1" /> Order Complete & Dispatched
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
            <ClipboardList size={36} className="mx-auto text-slate-300" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Work Orders Dispatched</h4>
              <p className="text-xs text-slate-500 mt-0.5">Create your first production job order with recipe BOM auto-deduction.</p>
            </div>
            <button
              onClick={() => { triggerHaptic('light'); setShowAddModal(true); }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Create First Work Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Selection Toolbar for Bulk Operations */}
      <SelectionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredOrders.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onCancel={() => {
          setSelectedIds([]);
          setIsSelectMode(false);
        }}
        actions={bulkActions}
      />

      {/* Bulk Priority Modal */}
      {showBulkPriorityModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Priority Assignment</h3>
                  <p className="text-xs text-slate-500">Update priority for {selectedIds.length} orders</p>
                </div>
              </div>
              <button onClick={() => setShowBulkPriorityModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkSetPriority} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-2">
                {['Normal', 'High', 'Urgent'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBulkPriorityValue(p)}
                    className={`py-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      bulkPriorityValue === p
                        ? p === 'Urgent'
                          ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500/30'
                          : p === 'High'
                          ? 'border-amber-600 bg-amber-50 text-amber-800 ring-2 ring-amber-500/30'
                          : 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/30'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
              >
                Apply "{bulkPriorityValue}" to {selectedIds.length} Orders
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Reassignment</h3>
                  <p className="text-xs text-slate-500">Reassign station & lead for {selectedIds.length} orders</p>
                </div>
              </div>
              <button onClick={() => setShowBulkAssignModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkReassign} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Assign Production Line / Station
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { triggerHaptic('light'); setBulkStationValue(''); }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      bulkStationValue === ''
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    -- Keep Current --
                  </button>
                  {machines.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setBulkStationValue(m.name); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                        bulkStationValue === m.name
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        m.status === 'Running' ? 'bg-emerald-500' : m.status === 'Idle' ? 'bg-amber-400' : 'bg-slate-400'
                      }`} />
                      <span>{m.name}</span>
                      <span className="text-[10px] opacity-70">({m.code})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Assign Shift Lead / Operator
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { triggerHaptic('light'); setBulkAssigneeValue(''); }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      bulkAssigneeValue === ''
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    -- Keep Current --
                  </button>
                  {staff.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setBulkAssigneeValue(s.name); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                        bulkAssigneeValue === s.name
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s.status === 'On Duty' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} />
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-70">({s.role})</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
              >
                Reassign {selectedIds.length} Work Orders
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Output & Deduct BOM Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Log Production Output</h3>
              <button onClick={() => setShowProgressModal(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleLogProgress} className="space-y-4 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-700">{showProgressModal.orderNumber}: {showProgressModal.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Current: {showProgressModal.completedQty} / {showProgressModal.quantity} units
                </p>
                {showProgressModal.bom && showProgressModal.bom.length > 0 && (
                  <div className="mt-2 text-[10px] text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                    ⚡ <strong>Automatic Material Deduction:</strong> Raw materials will automatically decrease from warehouse inventory based on completed units!
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Units Completed in this Batch *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={progressUnits}
                  onChange={(e) => setProgressUnits(e.target.value)}
                  required
                  min="1"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
                >
                  Confirm Units & Deduct Raw Materials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Work Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ClipboardList size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Dispatch Work Order</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              {/* Product Recipe Selector with Live Stock Sufficiency Preview */}
              {recipes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                    <span>Select Product Recipe (BOM Formula)</span>
                    {newOrder.recipeId && (
                      <span className="text-[10px] text-indigo-600 font-bold">Formula Linked</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setNewOrder(prev => ({ ...prev, recipeId: '' }))}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                        !newOrder.recipeId
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>-- Custom Order (No Recipe Link) --</span>
                      {!newOrder.recipeId && <Check size={14} className="text-blue-600" />}
                    </button>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                      {recipes.map(r => {
                        const isSelected = newOrder.recipeId === r.id;
                        const stockCheck = checkRecipeSufficiency(r, newOrder.quantity || 100);

                        return (
                          <div
                            key={r.id}
                            onClick={() => {
                              triggerHaptic('light');
                              setNewOrder(prev => ({
                                ...prev,
                                recipeId: r.id,
                                product: r.name,
                                title: prev.title || `${r.name} Production Job`
                              }));
                            }}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-600/30 shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-900">{r.name}</span>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">{r.sku}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {r.ingredients?.length || 0} materials in formula
                              </p>
                              <div className="mt-1">
                                {stockCheck.sufficient ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center inline-flex">
                                    <CheckCircle2 size={10} className="mr-1" /> Sufficient Stock
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center inline-flex">
                                    <AlertTriangle size={10} className="mr-1" /> Shortage on {stockCheck.shortages[0]?.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isSelected && <Check size={18} className="text-indigo-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Job Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Hydraulic Cylinder Run #1"
                  value={newOrder.title}
                  onChange={(e) => setNewOrder({ ...newOrder, title: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Model *</label>
                  <input
                    type="text"
                    placeholder="e.g. Model HC-50"
                    value={newOrder.product}
                    onChange={(e) => setNewOrder({ ...newOrder, product: e.target.value })}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Quantity *</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Advanced Priority Visual Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Priority Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Normal', label: 'Normal', desc: 'Standard 5d SLA', color: 'blue' },
                    { id: 'High', label: 'High', desc: 'High 48h SLA', color: 'amber' },
                    { id: 'Urgent', label: 'Urgent', desc: 'Critical 24h SLA', color: 'rose' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewOrder({ ...newOrder, priority: p.id }); }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        newOrder.priority === p.id
                          ? p.id === 'Urgent'
                            ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/30'
                            : p.id === 'High'
                            ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/30'
                            : 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs font-bold">{p.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Station & Assignee Pickers */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase flex items-center">
                      <Cpu size={12} className="mr-1 text-slate-400" /> Work Station / Line
                    </label>
                    {newOrder.assignedStation && (
                      <span className="text-[11px] font-bold text-indigo-600 truncate max-w-[140px]">
                        {newOrder.assignedStation}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
                    {machines.map(m => {
                      const isSelected = newOrder.assignedStation === m.name;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setNewOrder({ ...newOrder, assignedStation: isSelected ? '' : m.name });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            m.status === 'Running' ? 'bg-emerald-500' : m.status === 'Idle' ? 'bg-amber-400' : 'bg-slate-400'
                          }`} />
                          <span>{m.name}</span>
                        </button>
                      );
                    })}
                    {['Assembly Line 1', 'Assembly Line 2', 'Machining Bay'].map(lineName => {
                      const isSelected = newOrder.assignedStation === lineName;
                      return (
                        <button
                          key={lineName}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setNewOrder({ ...newOrder, assignedStation: isSelected ? '' : lineName });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {lineName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase flex items-center">
                      <User size={12} className="mr-1 text-slate-400" /> Assigned Lead / Operator
                    </label>
                    {newOrder.assignedTo && (
                      <span className="text-[11px] font-bold text-purple-600 truncate max-w-[140px]">
                        {newOrder.assignedTo}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
                    {staff.map(s => {
                      const isSelected = newOrder.assignedTo === s.name;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setNewOrder({ ...newOrder, assignedTo: isSelected ? '' : s.name });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'On Duty' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                          <span>{s.name}</span>
                          <span className="text-[10px] opacity-70">({s.role})</span>
                        </button>
                      );
                    })}
                    {['Floor Supervisor', 'Lead Technician'].map(roleName => {
                      const isSelected = newOrder.assignedTo === roleName;
                      return (
                        <button
                          key={roleName}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setNewOrder({ ...newOrder, assignedTo: isSelected ? '' : roleName });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {roleName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Due Date</label>
                <input
                  type="date"
                  value={newOrder.dueDate}
                  onChange={(e) => setNewOrder({ ...newOrder, dueDate: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Custom BOM Material if no Recipe is selected */}
              {!newOrder.recipeId && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-900 mb-2">Custom Bill of Materials (BOM)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newOrder.selectedMaterialId}
                      onChange={(e) => setNewOrder({ ...newOrder, selectedMaterialId: e.target.value })}
                      className="p-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium"
                    >
                      <option value="">-- No Raw Material --</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit})</option>
                      ))}
                    </select>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Qty/Unit"
                        value={newOrder.qtyPerUnit}
                        onChange={(e) => setNewOrder({ ...newOrder, qtyPerUnit: e.target.value })}
                        className="p-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium w-full"
                      />
                      <span className="text-[11px] text-indigo-700 font-semibold whitespace-nowrap">/unit</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
                >
                  Confirm & Dispatch Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Work Order</h3>
              </div>
              <button onClick={() => setEditingOrder(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Job Title *</label>
                <input
                  type="text"
                  value={editingOrder.title}
                  onChange={(e) => setEditingOrder({ ...editingOrder, title: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Model *</label>
                  <input
                    type="text"
                    value={editingOrder.product}
                    onChange={(e) => setEditingOrder({ ...editingOrder, product: e.target.value })}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Quantity *</label>
                  <input
                    type="number"
                    value={editingOrder.quantity}
                    onChange={(e) => setEditingOrder({ ...editingOrder, quantity: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600"
                  />
                </div>
              </div>

              {/* Visual Status Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Stage Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Pending', label: 'Pending', icon: '⏳', color: 'border-slate-400 bg-slate-50 text-slate-800' },
                    { id: 'In Progress', label: 'In Progress', icon: '⚙️', color: 'border-blue-500 bg-blue-50 text-blue-900' },
                    { id: 'Quality Check', label: 'Quality Check', icon: '🔍', color: 'border-purple-500 bg-purple-50 text-purple-900' },
                    { id: 'Completed', label: 'Completed', icon: '✅', color: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                  ].map(st => {
                    const isSelected = editingOrder.status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingOrder({ ...editingOrder, status: st.id }); }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center space-x-2 transition ${
                          isSelected
                            ? `${st.color} ring-2 ring-blue-500/20 shadow-2xs`
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{st.icon}</span>
                        <span className="truncate">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Priority Segmented Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Normal', label: 'Normal', color: 'bg-slate-100 text-slate-700 active:bg-slate-200' },
                    { id: 'High', label: 'High', color: 'bg-amber-500 text-white shadow-2xs' },
                    { id: 'Urgent', label: 'Urgent', color: 'bg-rose-600 text-white shadow-2xs' },
                  ].map(pr => {
                    const isSelected = editingOrder.priority === pr.id;
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingOrder({ ...editingOrder, priority: pr.id }); }}
                        className={`py-2 px-3 rounded-xl border text-center text-xs font-bold transition ${
                          isSelected
                            ? `${pr.color} border-transparent ring-2 ring-slate-900/10`
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Work Station</label>
                  <input
                    type="text"
                    value={editingOrder.assignedStation}
                    onChange={(e) => setEditingOrder({ ...editingOrder, assignedStation: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Lead</label>
                  <input
                    type="text"
                    value={editingOrder.assignedTo}
                    onChange={(e) => setEditingOrder({ ...editingOrder, assignedTo: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Due Date</label>
                <input
                  type="date"
                  value={editingOrder.dueDate}
                  onChange={(e) => setEditingOrder({ ...editingOrder, dueDate: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
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
