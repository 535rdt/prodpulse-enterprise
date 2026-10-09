import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, Target, Plus, Trash2, Sun, Moon, Sunset, Share2, 
  Cpu, AlertOctagon, Wrench, Activity, Clock, CheckCircle2,
  AlertTriangle, Thermometer, Layers, BookOpen, Search, 
  Boxes, Play, Sparkles, X, ChevronRight, ArrowDownRight, Pencil,
  Filter, ArrowUpDown, Check, CheckSquare, Square, ShieldCheck,
  User, Users, ChevronDown
} from 'lucide-react';
import { 
  getProduction, setProduction, getMachines, setMachines, 
  getDowntimeLogs, setDowntimeLogs, getWorkOrders,
  getRecipes, setRecipes, deductRecipeMaterials, deductBOM,
  getMaterials, getStaff
} from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';
import SelectionToolbar from '../components/SelectionToolbar';
import SearchableMaterialSelect from '../components/SearchableMaterialSelect';
import { useBackAction } from '../utils/backButton';

export default function Production() {
  const [activeTab, setActiveTab] = useState('RUNS'); // 'RUNS' | 'RECIPES' | 'MACHINES'
  const [dailyTarget, setDailyTarget] = useState(500);
  const [history, setHistory] = useState([]);
  const [machines, setMachinesList] = useState([]);
  const [downtimeLogs, setDowntimeList] = useState([]);
  const [workOrders, setWorkOrdersList] = useState([]);
  const [recipes, setRecipesList] = useState([]);
  const [materials, setMaterialsList] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Multi-Selection Modes & IDs
  const [isRunSelectMode, setIsRunSelectMode] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState([]);

  const [isMachineSelectMode, setIsMachineSelectMode] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState([]);

  const [isRecipeSelectMode, setIsRecipeSelectMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);

  // Advanced Run Filter & Sort
  const [runStatusFilter, setRunStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'UNDER' | 'DEFECT'
  const [runShiftFilter, setRunShiftFilter] = useState('ALL'); // 'ALL' | 'Morning' | 'Day' | 'Night'
  const [runSortBy, setRunSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'OUTPUT_DESC' | 'OUTPUT_ASC' | 'DEFECT_DESC'

  // Advanced Machine Filter
  const [machineStatusFilter, setMachineStatusFilter] = useState('ALL'); // 'ALL' | 'Running' | 'Idle' | 'Maintenance' | 'Offline'

  // Advanced Recipe Filter
  const [recipeStockFilter, setRecipeStockFilter] = useState('ALL'); // 'ALL' | 'SUFFICIENT' | 'SHORTAGE'

  // Bulk Action Modals
  const [showBulkRunShiftModal, setShowBulkRunShiftModal] = useState(false);
  const [bulkRunShiftValue, setBulkRunShiftValue] = useState('Morning');

  const [showBulkMachineStatusModal, setShowBulkMachineStatusModal] = useState(false);
  const [bulkMachineStatusValue, setBulkMachineStatusValue] = useState('Running');

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);

  // Edit Modals & States
  const [editingRun, setEditingRun] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [editingMachine, setEditingMachine] = useState(null);
  const [editingDowntime, setEditingDowntime] = useState(null);

  // Hardware Back Button Handlers
  const isAnyModalOpen = showLogModal || showDowntimeModal || showAddMachineModal || showAddRecipeModal ||
    showBulkRunShiftModal || showBulkMachineStatusModal || 
    !!editingRun || !!editingRecipe || !!editingMachine || !!editingDowntime;

  useBackAction(() => {
    if (showLogModal) { setShowLogModal(false); return true; }
    if (showDowntimeModal) { setShowDowntimeModal(false); return true; }
    if (showAddMachineModal) { setShowAddMachineModal(false); return true; }
    if (showAddRecipeModal) { setShowAddRecipeModal(false); return true; }
    if (showBulkRunShiftModal) { setShowBulkRunShiftModal(false); return true; }
    if (showBulkMachineStatusModal) { setShowBulkMachineStatusModal(false); return true; }
    if (editingRun) { setEditingRun(null); return true; }
    if (editingRecipe) { setEditingRecipe(null); return true; }
    if (editingMachine) { setEditingMachine(null); return true; }
    if (editingDowntime) { setEditingDowntime(null); return true; }
    return false;
  }, isAnyModalOpen, 90);

  useBackAction(() => {
    if (isRunSelectMode) { setIsRunSelectMode(false); setSelectedRunIds([]); return true; }
    if (isMachineSelectMode) { setIsMachineSelectMode(false); setSelectedMachineIds([]); return true; }
    if (isRecipeSelectMode) { setIsRecipeSelectMode(false); setSelectedRecipeIds([]); return true; }
    return false;
  }, isRunSelectMode || isMachineSelectMode || isRecipeSelectMode, 80);

  // Trace back to main RUNS tab before leaving page
  useBackAction(() => {
    if (activeTab !== 'RUNS') {
      triggerHaptic('light');
      setActiveTab('RUNS');
      return true;
    }
    return false;
  }, activeTab !== 'RUNS', 70);

  // Search & Filter
  const [recipeSearch, setRecipeSearch] = useState('');

  // Auto-detect current active shift based on device time
  const getCurrentShift = () => {
    const hr = new Date().getHours();
    if (hr >= 6 && hr < 14) return 'Morning';
    if (hr >= 14 && hr < 22) return 'Day';
    return 'Night';
  };

  // New Machine Form State
  const [newMachine, setNewMachine] = useState({
    code: '',
    name: '',
    type: 'Machining',
    temp: '35°C'
  });

  // New Batch Run State
  const [newRun, setNewRun] = useState({
    batch: '',
    recipeId: '',
    target: 500,
    produced: '',
    defective: 0,
    shift: 'Morning',
    operator: '',
    notes: '',
    machineId: '',
    workOrderId: ''
  });

  // New Product Recipe Form State
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    sku: '',
    outputUnit: 'units',
    description: '',
    ingredients: [
      { materialId: '', qtyPerUnit: 1, materialName: '', unit: 'kg' }
    ]
  });

  // New Downtime Incident State
  const [newIncident, setNewIncident] = useState({
    machineId: '',
    durationMinutes: 15,
    reason: '',
    resolvedBy: ''
  });

  const loadData = async () => {
    try {
      const data = await getProduction();
      const machs = await getMachines();
      const dtimes = await getDowntimeLogs();
      const ords = await getWorkOrders();
      const recs = await getRecipes();
      const mats = await getMaterials();
      const stf = await getStaff();

      const targetVal = Number(data.rate) || 500;
      setDailyTarget(targetVal);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setMachinesList(Array.isArray(machs) ? machs : []);
      setDowntimeList(Array.isArray(dtimes) ? dtimes : []);
      setWorkOrdersList(Array.isArray(ords) ? ords : []);
      setRecipesList(Array.isArray(recs) ? recs : []);
      setMaterialsList(Array.isArray(mats) ? mats : []);
      setStaffList(Array.isArray(stf) ? stf : []);

      setNewRun(prev => ({ 
        ...prev, 
        target: targetVal, 
        produced: '',
        batch: '',
        shift: getCurrentShift(),
        machineId: machs[0]?.id || '',
        workOrderId: ords[0]?.id || '',
        recipeId: recs[0]?.id || ''
      }));
    } catch (err) {
      console.error('Error loading production data:', err);
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

  const handleUpdateTarget = async (delta) => {
    const next = Math.max(50, dailyTarget + delta);
    setDailyTarget(next);
    await triggerHaptic('light');
    await setProduction(next, history);
  };

  const handleManualTargetChange = async (val) => {
    const num = Math.max(0, Number(val) || 0);
    setDailyTarget(num);
    await setProduction(num, history);
  };

  // Calculate maximum batch capacity for a recipe based on available warehouse inventory
  const getRecipeCapacity = (recipe) => {
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      return { units: 0, limitingMaterial: null };
    }
    let minUnits = Infinity;
    let limitingMaterial = null;

    for (const ing of recipe.ingredients) {
      if (!ing) continue;
      const targetMat = (materials || []).find(m => 
        m && (
          (m.id && ing.materialId && m.id === ing.materialId) || 
          (m.name && ing.materialName && String(m.name).toLowerCase() === String(ing.materialName).toLowerCase())
        )
      );
      const inStock = targetMat ? (Number(targetMat.quantity) || 0) : 0;
      const reqPerUnit = Number(ing.qtyPerUnit) || 0;

      if (reqPerUnit > 0) {
        const possible = Math.floor(inStock / reqPerUnit);
        if (possible < minUnits) {
          minUnits = possible;
          limitingMaterial = targetMat ? targetMat.name : (ing.materialName || 'Raw Material');
        }
      }
    }

    return {
      units: minUnits === Infinity ? 0 : minUnits,
      limitingMaterial
    };
  };

  // Record a production run and automatically decrease raw materials
  const handleLogRun = async (e) => {
    e.preventDefault();
    if (!newRun.produced || Number(newRun.produced) <= 0) {
      await triggerHaptic('heavy');
      await showToast('Valid produced quantity required');
      return;
    }

    await triggerHaptic('success');
    const targetVal = Number(newRun.target) || dailyTarget || 1;
    const producedVal = Number(newRun.produced) || 0;
    const eff = Math.round((producedVal / targetVal) * 100);

    let status = 'Completed';
    if (eff >= 105) status = 'Exceeded';
    else if (eff < 90) status = 'Under Target';

    let deductedItems = [];
    let recipeLinkedName = '';

    // Automatic raw material inventory deduction based on selected Recipe
    if (newRun.recipeId) {
      const deductionRes = await deductRecipeMaterials(newRun.recipeId, producedVal);
      if (deductionRes.success) {
        deductedItems = deductionRes.deductedSummary || [];
        recipeLinkedName = deductionRes.recipeName || '';
      }
    } else if (newRun.workOrderId) {
      // Automatic deduction based on Work Order BOM
      const bomRes = await deductBOM(newRun.workOrderId, producedVal);
      if (bomRes.success && Array.isArray(bomRes.details)) {
        deductedItems = bomRes.details;
      }
    }

    // Refresh warehouse raw materials list in state
    const freshMats = await getMaterials();
    setMaterialsList(freshMats);

    const entry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      batch: (newRun.batch || '').trim() || `Batch #${Date.now().toString().slice(-4)}`,
      recipeId: newRun.recipeId || null,
      recipeName: recipeLinkedName || null,
      workOrderId: newRun.workOrderId || 'General Run',
      machineId: newRun.machineId || 'Line',
      target: targetVal,
      produced: producedVal,
      defective: Number(newRun.defective) || 0,
      shift: newRun.shift || 'Morning',
      operator: (newRun.operator || '').trim() || 'Floor Operator',
      status,
      notes: (newRun.notes || '').trim() || 'Optimal line operation',
      consumedMaterials: deductedItems
    };

    const updatedHistory = [entry, ...history];
    setHistory(updatedHistory);
    await setProduction(dailyTarget, updatedHistory);
    setShowLogModal(false);
    setActiveTab('RUNS'); // Switch to runs tab so user immediately sees their logged batch!

    setNewRun({
      batch: '',
      recipeId: recipes[0]?.id || '',
      target: dailyTarget,
      produced: '',
      defective: 0,
      shift: 'Morning',
      operator: '',
      notes: '',
      machineId: machines[0]?.id || '',
      workOrderId: workOrders[0]?.id || ''
    });

    if (deductedItems.length > 0) {
      const summaryMsg = deductedItems.map(d => `${d.name}: -${d.deducted} ${d.unit}`).join(', ');
      await showToast(`Batch recorded! Raw materials auto-decreased: ${summaryMsg}`);
    } else {
      await showToast('Production run logged successfully!');
    }
  };

  const handleStartEditRun = (run) => {
    triggerHaptic('light');
    setEditingRun({
      ...run,
      batch: run.batch || '',
      recipeId: run.recipeId || '',
      workOrderId: run.workOrderId || '',
      machineId: run.machineId || '',
      target: run.target !== undefined ? run.target : (dailyTarget || 500),
      produced: run.produced !== undefined ? run.produced : '',
      defective: run.defective !== undefined ? run.defective : 0,
      shift: run.shift || 'Morning',
      operator: run.operator || '',
      notes: run.notes || '',
      status: run.status || 'Completed'
    });
  };

  const handleSaveEditRun = async (e) => {
    e.preventDefault();
    if (!editingRun.batch || editingRun.produced === '') {
      await triggerHaptic('heavy');
      await showToast('Batch name and produced quantity are required');
      return;
    }
    await triggerHaptic('success');
    const recipeObj = recipes.find(r => r.id === editingRun.recipeId);
    const targetNum = Number(editingRun.target) || 1;
    const producedNum = Number(editingRun.produced) || 0;
    const eff = Math.round((producedNum / targetNum) * 100);
    const status = eff >= 100 ? 'Exceeded' : eff >= 90 ? 'Optimal' : 'Under Target';

    const updated = history.map(h => {
      if (h.id === editingRun.id) {
        return {
          ...h,
          batch: editingRun.batch.trim(),
          recipeId: editingRun.recipeId || null,
          recipeName: recipeObj ? recipeObj.name : h.recipeName,
          workOrderId: editingRun.workOrderId,
          machineId: editingRun.machineId,
          target: targetNum,
          produced: producedNum,
          defective: Number(editingRun.defective) || 0,
          shift: editingRun.shift,
          operator: editingRun.operator.trim() || 'Floor Operator',
          notes: editingRun.notes.trim() || 'Optimal line operation',
          status
        };
      }
      return h;
    });

    setHistory(updated);
    await setProduction(dailyTarget, updated);
    setEditingRun(null);
    await showToast(`Run ${editingRun.batch} updated successfully!`);
  };

  const handleDeleteRun = async (id) => {
    if (window.confirm('Delete this production run record?')) {
      await triggerHaptic('medium');
      const updated = history.filter(h => h && h.id !== id);
      setHistory(updated);
      await setProduction(dailyTarget, updated);
      await showToast('Run entry deleted');
    }
  };

  // Recipe Creation & Management
  const handleAddIngredientRow = () => {
    const defaultMat = materials[0];
    setNewRecipe(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          materialId: defaultMat?.id || '',
          materialName: defaultMat?.name || '',
          qtyPerUnit: 1,
          unit: defaultMat?.unit || 'kg'
        }
      ]
    }));
  };

  const handleRemoveIngredientRow = (index) => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, idx) => idx !== index)
    }));
  };

  const handleIngredientChange = (index, field, value) => {
    setNewRecipe(prev => {
      const updated = [...prev.ingredients];
      if (field === 'materialId') {
        const mat = materials.find(m => m.id === value);
        updated[index] = {
          ...updated[index],
          materialId: value,
          materialName: mat ? mat.name : '',
          unit: mat ? mat.unit : updated[index].unit
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, ingredients: updated };
    });
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    if (!newRecipe.name.trim()) {
      await showToast('Please enter a Product Recipe Name');
      return;
    }

    const validIngredients = newRecipe.ingredients.filter(ing => 
      (ing.materialId || ing.materialName) && Number(ing.qtyPerUnit) > 0
    );

    if (validIngredients.length === 0) {
      await showToast('Please add at least one material with required quantity');
      return;
    }

    await triggerHaptic('success');
    const recipeEntry = {
      id: `RCP-${Date.now().toString().slice(-4)}`,
      sku: (newRecipe.sku || '').trim() || `SKU-${newRecipe.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      name: newRecipe.name.trim(),
      product: newRecipe.name.trim(),
      outputUnit: newRecipe.outputUnit || 'units',
      description: newRecipe.description.trim(),
      ingredients: validIngredients.map(ing => {
        const targetMat = materials.find(m => m.id === ing.materialId);
        return {
          materialId: ing.materialId,
          materialName: targetMat ? targetMat.name : (ing.materialName || 'Raw Material'),
          qtyPerUnit: Number(ing.qtyPerUnit),
          unit: targetMat ? targetMat.unit : (ing.unit || 'units')
        };
      }),
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [recipeEntry, ...recipes];
    setRecipesList(updated);
    await setRecipes(updated);
    setShowAddRecipeModal(false);

    setNewRecipe({
      name: '',
      sku: '',
      outputUnit: 'units',
      description: '',
      ingredients: [{ materialId: materials[0]?.id || '', qtyPerUnit: 1, materialName: '', unit: 'kg' }]
    });

    await showToast(`Recipe "${recipeEntry.name}" created! Ready for production auto-deduction.`);
  };

  const handleDeleteRecipe = async (id, name) => {
    if (window.confirm(`Delete product recipe "${name}"?`)) {
      await triggerHaptic('heavy');
      const updated = recipes.filter(r => r.id !== id);
      setRecipesList(updated);
      await setRecipes(updated);
      await showToast('Product recipe removed');
    }
  };

  const handleStartEditRecipe = (recipe) => {
    triggerHaptic('light');
    setEditingRecipe({
      ...recipe,
      name: recipe.name || '',
      sku: recipe.sku || '',
      outputUnit: recipe.outputUnit || 'units',
      description: recipe.description || '',
      ingredients: Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 
        ? recipe.ingredients.map(ing => ({ ...ing }))
        : [{ materialId: materials[0]?.id || '', qtyPerUnit: 1, materialName: materials[0]?.name || '', unit: materials[0]?.unit || 'kg' }]
    });
  };

  const handleEditRecipeAddIngredient = () => {
    const defaultMat = materials[0];
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          materialId: defaultMat?.id || '',
          materialName: defaultMat?.name || '',
          qtyPerUnit: 1,
          unit: defaultMat?.unit || 'kg'
        }
      ]
    }));
  };

  const handleEditRecipeRemoveIngredient = (index) => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, idx) => idx !== index)
    }));
  };

  const handleEditRecipeIngredientChange = (index, field, value) => {
    setEditingRecipe(prev => {
      const updated = [...prev.ingredients];
      if (field === 'materialId') {
        const mat = materials.find(m => m.id === value);
        updated[index] = {
          ...updated[index],
          materialId: value,
          materialName: mat ? mat.name : '',
          unit: mat ? mat.unit : updated[index].unit
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, ingredients: updated };
    });
  };

  const handleSaveEditRecipe = async (e) => {
    e.preventDefault();
    if (!editingRecipe.name.trim()) {
      await showToast('Please enter a Product Recipe Name');
      return;
    }
    const validIngredients = editingRecipe.ingredients.filter(ing => 
      (ing.materialId || ing.materialName) && Number(ing.qtyPerUnit) > 0
    );
    if (validIngredients.length === 0) {
      await showToast('Please add at least one material with required quantity');
      return;
    }
    await triggerHaptic('success');
    const updated = recipes.map(r => {
      if (r.id === editingRecipe.id) {
        return {
          ...r,
          name: editingRecipe.name.trim(),
          product: editingRecipe.name.trim(),
          sku: (editingRecipe.sku || '').trim() || r.sku,
          outputUnit: editingRecipe.outputUnit || 'units',
          description: editingRecipe.description.trim(),
          ingredients: validIngredients.map(ing => {
            const targetMat = materials.find(m => m.id === ing.materialId);
            return {
              materialId: ing.materialId,
              materialName: targetMat ? targetMat.name : (ing.materialName || 'Raw Material'),
              qtyPerUnit: Number(ing.qtyPerUnit),
              unit: targetMat ? targetMat.unit : (ing.unit || 'units')
            };
          })
        };
      }
      return r;
    });

    setRecipesList(updated);
    await setRecipes(updated);
    setEditingRecipe(null);
    await showToast(`Recipe "${editingRecipe.name}" updated!`);
  };

  // Machine Management
  const handleAddMachine = async (e) => {
    e.preventDefault();
    if (!newMachine.name.trim() || !newMachine.code.trim()) {
      await showToast('Please enter machine name and code');
      return;
    }
    await triggerHaptic('success');
    const machineEntry = {
      id: `M-${Date.now()}`,
      code: newMachine.code.trim().toUpperCase(),
      name: newMachine.name.trim(),
      type: newMachine.type.trim() || 'General',
      status: 'Running',
      uptime: '99.8%',
      temp: newMachine.temp || '35°C',
      lastService: new Date().toISOString().split('T')[0]
    };
    const updated = [...machines, machineEntry];
    setMachinesList(updated);
    await setMachines(updated);
    setShowAddMachineModal(false);
    setNewMachine({
      code: '',
      name: '',
      type: 'Machining',
      temp: '35°C'
    });
    await showToast('Machine added to fleet');
  };

  const handleDeleteMachine = async (id, name) => {
    if (window.confirm(`Remove ${name || 'this machine'} from fleet?`)) {
      await triggerHaptic('medium');
      const updated = machines.filter(m => m.id !== id);
      setMachinesList(updated);
      await setMachines(updated);
      await showToast('Machine removed from fleet');
    }
  };

  const handleStartEditMachine = (mach) => {
    triggerHaptic('light');
    setEditingMachine({
      ...mach,
      code: mach.code || '',
      name: mach.name || '',
      type: mach.type || 'General',
      status: mach.status || 'Running',
      uptime: mach.uptime || '99.8%',
      temp: mach.temp || '35°C'
    });
  };

  const handleSaveEditMachine = async (e) => {
    e.preventDefault();
    if (!editingMachine.name.trim() || !editingMachine.code.trim()) {
      await showToast('Please enter machine name and code');
      return;
    }
    await triggerHaptic('success');
    const updated = machines.map(m => {
      if (m.id === editingMachine.id) {
        return {
          ...m,
          code: editingMachine.code.trim().toUpperCase(),
          name: editingMachine.name.trim(),
          type: editingMachine.type.trim() || 'General',
          status: editingMachine.status,
          uptime: editingMachine.uptime || '99.8%',
          temp: editingMachine.temp || '35°C'
        };
      }
      return m;
    });
    setMachinesList(updated);
    await setMachines(updated);
    setEditingMachine(null);
    await showToast(`Machine "${editingMachine.name}" updated!`);
  };

  const handleToggleMachineStatus = async (machineId) => {
    await triggerHaptic('light');
    const flow = ['Running', 'Idle', 'Maintenance', 'Offline'];
    const updated = machines.map(m => {
      if (m.id === machineId) {
        const idx = flow.indexOf(m.status);
        const nextStatus = flow[(idx + 1) % flow.length];
        return { ...m, status: nextStatus };
      }
      return m;
    });
    setMachinesList(updated);
    await setMachines(updated);
    await showToast('Machine status updated');
  };

  const handleLogDowntime = async (e) => {
    e.preventDefault();
    await triggerHaptic('medium');

    const mach = machines.find(m => m.id === newIncident.machineId);
    const entry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      machineId: newIncident.machineId,
      machineName: mach ? mach.name : 'General Line',
      durationMinutes: Number(newIncident.durationMinutes) || 15,
      reason: newIncident.reason.trim() || 'Scheduled Maintenance',
      resolvedBy: newIncident.resolvedBy.trim() || 'Lead Tech'
    };

    const updated = [entry, ...downtimeLogs];
    setDowntimeList(updated);
    await setDowntimeLogs(updated);
    setShowDowntimeModal(false);
    setNewIncident({
      machineId: machines[0]?.id || '',
      durationMinutes: 15,
      reason: '',
      resolvedBy: ''
    });
    await showToast('Downtime incident logged');
  };

  const handleStartEditDowntime = (dt) => {
    triggerHaptic('light');
    setEditingDowntime({
      ...dt,
      machineId: dt.machineId || '',
      durationMinutes: dt.durationMinutes || 15,
      reason: dt.reason || '',
      resolvedBy: dt.resolvedBy || ''
    });
  };

  const handleSaveEditDowntime = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const mach = machines.find(m => m.id === editingDowntime.machineId);
    const updated = downtimeLogs.map(d => {
      if (d.id === editingDowntime.id) {
        return {
          ...d,
          machineId: editingDowntime.machineId,
          machineName: mach ? mach.name : (d.machineName || 'Line'),
          durationMinutes: Number(editingDowntime.durationMinutes) || 15,
          reason: editingDowntime.reason.trim() || 'Maintenance',
          resolvedBy: editingDowntime.resolvedBy.trim() || 'Lead Tech'
        };
      }
      return d;
    });
    setDowntimeList(updated);
    await setDowntimeLogs(updated);
    setEditingDowntime(null);
    await showToast('Downtime incident updated!');
  };

  const handleDeleteDowntime = async (id) => {
    if (window.confirm('Delete this downtime incident log?')) {
      await triggerHaptic('medium');
      const updated = downtimeLogs.filter(d => d.id !== id);
      setDowntimeList(updated);
      await setDowntimeLogs(updated);
      await showToast('Downtime log deleted');
    }
  };

  // Multi-Selection Handlers for Runs
  const toggleSelectRun = (id) => {
    triggerHaptic('light');
    setSelectedRunIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllRuns = () => {
    triggerHaptic('light');
    setSelectedRunIds(filteredRuns.map(r => r.id));
  };

  const handleDeselectAllRuns = () => {
    triggerHaptic('light');
    setSelectedRunIds([]);
  };

  const handleBulkReassignRunShift = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = history.map(r => {
      if (selectedRunIds.includes(r.id)) {
        return { ...r, shift: bulkRunShiftValue };
      }
      return r;
    });
    setHistory(updated);
    await setProduction(dailyTarget, updated);
    setShowBulkRunShiftModal(false);
    await showToast(`Updated ${selectedRunIds.length} runs to ${bulkRunShiftValue} shift!`);
    setSelectedRunIds([]);
  };

  const handleBulkExportRuns = async () => {
    await triggerHaptic('light');
    const selected = history.filter(r => selectedRunIds.includes(r.id));
    const jsonStr = JSON.stringify(selected, null, 2);
    await shareOrCopy({
      title: 'Export Selected Production Runs',
      text: `Export of ${selected.length} production runs.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDeleteRuns = async () => {
    if (window.confirm(`Delete ${selectedRunIds.length} selected production runs?`)) {
      await triggerHaptic('heavy');
      const updated = history.filter(r => !selectedRunIds.includes(r.id));
      setHistory(updated);
      await setProduction(dailyTarget, updated);
      setSelectedRunIds([]);
      await showToast(`Deleted ${selectedRunIds.length} production runs.`);
    }
  };

  // Multi-Selection Handlers for Machines
  const toggleSelectMachine = (id) => {
    triggerHaptic('light');
    setSelectedMachineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllMachines = () => {
    triggerHaptic('light');
    setSelectedMachineIds(filteredMachines.map(m => m.id));
  };

  const handleDeselectAllMachines = () => {
    triggerHaptic('light');
    setSelectedMachineIds([]);
  };

  const handleBulkSetMachineStatus = async (statusVal) => {
    await triggerHaptic('success');
    const updated = machines.map(m => {
      if (selectedMachineIds.includes(m.id)) {
        return { ...m, status: statusVal };
      }
      return m;
    });
    setMachinesList(updated);
    await setMachines(updated);
    setShowBulkMachineStatusModal(false);
    await showToast(`Updated ${selectedMachineIds.length} machines to "${statusVal}"!`);
    setSelectedMachineIds([]);
  };

  const handleBulkExportMachines = async () => {
    await triggerHaptic('light');
    const selected = machines.filter(m => selectedMachineIds.includes(m.id));
    const jsonStr = JSON.stringify(selected, null, 2);
    await shareOrCopy({
      title: 'Machine Fleet Telemetry',
      text: `Telemetry specifications for ${selected.length} machines.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDeleteMachines = async () => {
    if (window.confirm(`Remove ${selectedMachineIds.length} selected machines from fleet?`)) {
      await triggerHaptic('heavy');
      const updated = machines.filter(m => !selectedMachineIds.includes(m.id));
      setMachinesList(updated);
      await setMachines(updated);
      setSelectedMachineIds([]);
      await showToast(`Removed ${selectedMachineIds.length} machines.`);
    }
  };

  // Multi-Selection Handlers for Recipes
  const toggleSelectRecipe = (id) => {
    triggerHaptic('light');
    setSelectedRecipeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllRecipes = () => {
    triggerHaptic('light');
    setSelectedRecipeIds(filteredRecipes.map(r => r.id));
  };

  const handleDeselectAllRecipes = () => {
    triggerHaptic('light');
    setSelectedRecipeIds([]);
  };

  const handleBulkExportRecipes = async () => {
    await triggerHaptic('light');
    const selected = recipes.filter(r => selectedRecipeIds.includes(r.id));
    const jsonStr = JSON.stringify(selected, null, 2);
    await shareOrCopy({
      title: 'Product Recipes & Formulas',
      text: `Formulas for ${selected.length} selected product recipes.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDeleteRecipes = async () => {
    if (window.confirm(`Delete ${selectedRecipeIds.length} selected recipes? Formulas and raw material bindings will be lost.`)) {
      await triggerHaptic('heavy');
      const updated = recipes.filter(r => !selectedRecipeIds.includes(r.id));
      setRecipesList(updated);
      await setRecipes(updated);
      setSelectedRecipeIds([]);
      await showToast(`Deleted ${selectedRecipeIds.length} recipes.`);
    }
  };

  // Filtered & Sorted Runs
  const filteredRuns = useMemo(() => {
    let list = Array.isArray(history) ? [...history] : [];

    if (runStatusFilter === 'COMPLETED') {
      list = list.filter(r => {
        const tgt = Number(r.target) || dailyTarget || 1;
        const prod = Number(r.produced) || 0;
        return (prod / tgt) >= 1;
      });
    } else if (runStatusFilter === 'UNDER') {
      list = list.filter(r => {
        const tgt = Number(r.target) || dailyTarget || 1;
        const prod = Number(r.produced) || 0;
        return (prod / tgt) < 0.9;
      });
    } else if (runStatusFilter === 'DEFECT') {
      list = list.filter(r => Number(r.defective) > 0);
    }

    if (runShiftFilter !== 'ALL') {
      list = list.filter(r => r.shift === runShiftFilter);
    }

    if (runSortBy === 'DATE_DESC') {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (runSortBy === 'DATE_ASC') {
      list.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (runSortBy === 'OUTPUT_DESC') {
      list.sort((a, b) => (Number(b.produced) || 0) - (Number(a.produced) || 0));
    } else if (runSortBy === 'OUTPUT_ASC') {
      list.sort((a, b) => (Number(a.produced) || 0) - (Number(b.produced) || 0));
    } else if (runSortBy === 'DEFECT_DESC') {
      list.sort((a, b) => (Number(b.defective) || 0) - (Number(a.defective) || 0));
    }

    return list;
  }, [history, runStatusFilter, runShiftFilter, runSortBy, dailyTarget]);

  // Filtered Machines
  const filteredMachines = useMemo(() => {
    if (machineStatusFilter === 'ALL') return machines;
    return machines.filter(m => m.status === machineStatusFilter);
  }, [machines, machineStatusFilter]);

  // Filtered Recipes
  const filteredRecipes = useMemo(() => {
    let list = Array.isArray(recipes) ? [...recipes] : [];
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase();
      list = list.filter(r => 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.sku && r.sku.toLowerCase().includes(q))
      );
    }
    if (recipeStockFilter === 'SUFFICIENT') {
      list = list.filter(r => getRecipeCapacity(r).units > 0);
    } else if (recipeStockFilter === 'SHORTAGE') {
      list = list.filter(r => getRecipeCapacity(r).units === 0);
    }
    return list;
  }, [recipes, recipeSearch, recipeStockFilter, materials]);

  const handleExport = async () => {
    await triggerHaptic('light');
    const jsonStr = JSON.stringify({ history, recipes, machines, downtimeLogs }, null, 2);
    await shareOrCopy({
      title: 'Production Telemetry & Recipes',
      text: `Production log with ${history.length} batches, ${recipes.length} recipes, and ${machines.length} active machines.`,
      jsonString: jsonStr
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotal = (Array.isArray(history) ? history : [])
    .filter(h => h && h.date === todayStr)
    .reduce((acc, h) => acc + (Number(h.produced) || 0), 0);
  const todayProgress = dailyTarget > 0 ? Math.min(100, Math.round((todayTotal / dailyTarget) * 100)) : 0;

  const ShiftIcon = ({ shift }) => {
    if (shift === 'Night') return <Moon size={13} className="text-indigo-400 mr-1" />;
    if (shift === 'Day') return <Sunset size={13} className="text-amber-500 mr-1" />;
    return <Sun size={13} className="text-yellow-500 mr-1" />;
  };

  // Currently selected recipe in the Log Run modal
  const selectedRunRecipe = recipes.find(r => r.id === newRun.recipeId);

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Production & Recipes</h2>
          <p className="text-xs text-slate-500 font-medium">Formulas, auto-decreasing raw materials & batch execution</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm active:scale-95 transition flex items-center space-x-1"
          >
            <Share2 size={16} />
            <span className="text-xs font-bold hidden sm:inline">Export</span>
          </button>

          {activeTab === 'RUNS' && (
            <button
              onClick={() => { 
                triggerHaptic('light'); 
                setNewRun(p => ({ 
                  ...p, 
                  batch: '', 
                  produced: '', 
                  target: dailyTarget || '',
                  recipeId: recipes[0]?.id || ''
                }));
                setShowLogModal(true); 
              }}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
            >
              <Plus size={16} />
              <span>Log Run</span>
            </button>
          )}

          {activeTab === 'RECIPES' && (
            <button
              onClick={() => { 
                triggerHaptic('light'); 
                setNewRecipe({
                  name: '',
                  sku: '',
                  outputUnit: 'units',
                  description: '',
                  ingredients: [{ materialId: materials[0]?.id || '', qtyPerUnit: 1, materialName: '', unit: 'kg' }]
                });
                setShowAddRecipeModal(true); 
              }}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
            >
              <Plus size={16} />
              <span>New Recipe</span>
            </button>
          )}

          {activeTab === 'MACHINES' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => { triggerHaptic('light'); setShowAddMachineModal(true); }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              >
                <Plus size={16} />
                <span>Add Machine</span>
              </button>
              <button
                onClick={() => { triggerHaptic('light'); setShowDowntimeModal(true); }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition"
              >
                <AlertOctagon size={16} />
                <span>Log Incident</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3-Tab Production Switcher */}
      <div className="grid grid-cols-3 p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('RUNS'); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'RUNS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Factory size={15} />
          <span>Output & History ({history.length})</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('RECIPES'); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'RECIPES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={15} />
          <span>Product Recipes ({recipes.length})</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('MACHINES'); }}
          className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'MACHINES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu size={15} />
          <span>Machine Fleet ({machines.length})</span>
        </button>
      </div>

      {/* TAB 1: RUNS (Output, Target & History) */}
      {activeTab === 'RUNS' && (
        <>
          {/* Target Setting & Daily Quota Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
            <Factory size={160} className="absolute -right-6 -bottom-8 opacity-5 text-white pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-200">Global Quota Target</h3>
                  <p className="text-[11px] text-slate-400">Daily shop target per schedule</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                {todayProgress}% of Goal
              </span>
            </div>

            <div className="flex items-center justify-between bg-white/10 rounded-2xl p-3 border border-white/10">
              <button
                onClick={() => handleUpdateTarget(-50)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 font-bold text-lg text-white transition flex items-center justify-center"
              >
                -50
              </button>

              <div className="text-center">
                <input
                  type="number"
                  value={dailyTarget}
                  onChange={(e) => handleManualTargetChange(e.target.value)}
                  className="bg-transparent text-3xl font-black text-center text-white outline-none w-28"
                />
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Units / Day</span>
              </div>

              <button
                onClick={() => handleUpdateTarget(50)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 font-bold text-lg text-white transition flex items-center justify-center"
              >
                +50
              </button>
            </div>

            {/* Today's Running Output Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-300">
                <span>Today's Logged Output: <strong className="text-white">{todayTotal}</strong> units</span>
                <span>Target: <strong className="text-white">{dailyTarget}</strong></span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  style={{ width: `${todayProgress}%` }}
                  className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Quick Notice about Recipe Auto-Deduction */}
          {recipes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center space-x-2">
                <Sparkles size={16} className="text-blue-600 shrink-0" />
                <span className="font-semibold">
                  <strong>{recipes.length} active recipes</strong> available. When you log a batch with a recipe, raw materials automatically decrease!
                </span>
              </div>
              <button 
                onClick={() => setActiveTab('RECIPES')}
                className="text-blue-700 font-bold underline shrink-0 ml-2"
              >
                View Recipes
              </button>
            </div>
          )}

          {/* Production Runs History Header & Multi-Select Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Floor Run History</h3>
                <span className="text-xs font-semibold text-slate-500">{filteredRuns.length} of {history.length} Runs</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setIsRunSelectMode(!isRunSelectMode);
                    if (isRunSelectMode) setSelectedRunIds([]);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    isRunSelectMode
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckSquare size={14} />
                  <span>{isRunSelectMode ? 'Done' : 'Select'}</span>
                </button>
              </div>
            </div>

            {/* Advanced Status Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'ALL', label: 'All', count: history.length },
                { id: 'COMPLETED', label: '🟢 On-Target', count: (history || []).filter(r => (Number(r.produced) || 0) >= (Number(r.target) || dailyTarget || 1)).length },
                { id: 'UNDER', label: '⚠️ Under', count: (history || []).filter(r => ((Number(r.produced) || 0) / (Number(r.target) || dailyTarget || 1)) < 0.9).length },
                { id: 'DEFECT', label: '🔴 Defect / Scrap', count: (history || []).filter(r => Number(r.defective) > 0).length }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { triggerHaptic('light'); setRunStatusFilter(f.id); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                    runStatusFilter === f.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    runStatusFilter === f.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Shift & Sort Filter Row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {/* Shift Filter Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'ALL', label: 'All Shifts' },
                  { id: 'Morning', label: '☀️ Morning' },
                  { id: 'Day', label: '🌅 Day' },
                  { id: 'Night', label: '🌙 Night' }
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => { triggerHaptic('light'); setRunShiftFilter(s.id); }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap cursor-pointer ${
                      runShiftFilter === s.id
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div className="relative shrink-0">
                <select
                  value={runSortBy}
                  onChange={(e) => { triggerHaptic('light'); setRunSortBy(e.target.value); }}
                  className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DATE_DESC">⏱️ Newest First</option>
                  <option value="DATE_ASC">⏱️ Oldest First</option>
                  <option value="OUTPUT_DESC">📈 Output: High to Low</option>
                  <option value="OUTPUT_ASC">📉 Output: Low to High</option>
                  <option value="DEFECT_DESC">🚨 Most Scrap / Defects</option>
                </select>
              </div>
            </div>

            {/* Runs Cards Listing */}
            {filteredRuns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
                <Factory size={36} className="mx-auto text-slate-300" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">No Production Runs Found</h4>
                  <p className="text-xs text-slate-500 mt-0.5">No runs match your active filter criteria. Try adjusting filters or log a run.</p>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setRunStatusFilter('ALL');
                    setRunShiftFilter('ALL');
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              filteredRuns.map((run) => {
                const targetNum = Number(run.target) || dailyTarget || 1;
                const producedNum = Number(run.produced) || 0;
                const eff = Math.round((producedNum / targetNum) * 100);
                const isExceeded = eff >= 100;
                const isUnder = eff < 90;
                const isSelected = selectedRunIds.includes(run.id);

                return (
                  <div
                    key={run.id}
                    onClick={() => {
                      if (isRunSelectMode) toggleSelectRun(run.id);
                    }}
                    className={`bg-white p-4 rounded-2xl border transition shadow-sm relative space-y-3 ${
                      isSelected 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' 
                        : 'border-slate-200/80 hover:border-slate-300'
                    } ${isRunSelectMode ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2.5">
                        {isRunSelectMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelectRun(run.id); }}
                            className="mt-0.5 text-indigo-600 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-indigo-600 fill-indigo-100" />
                            ) : (
                              <Square size={18} className="text-slate-300" />
                            )}
                          </button>
                        )}

                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-sm font-black text-slate-900">{run.batch || 'Batch Run'}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isExceeded ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              isUnder ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {run.status || 'Completed'} ({eff}%)
                            </span>
                            {run.recipeName && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center">
                                <Layers size={10} className="mr-1 text-indigo-500" /> Recipe: {run.recipeName}
                              </span>
                            )}
                            {run.defective > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                Scrap: {run.defective}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1 font-medium">
                            <span>{run.date || 'Recent'}</span>
                            <span className="flex items-center"><ShiftIcon shift={run.shift} /> {run.shift || 'Morning'} Shift</span>
                            <span>Op: {run.operator || 'Staff'}</span>
                          </div>
                        </div>
                      </div>

                      {!isRunSelectMode && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartEditRun(run)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 transition cursor-pointer"
                            title="Edit Run"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRun(run.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                            title="Delete run entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Consumed Materials Display */}
                    {Array.isArray(run.consumedMaterials) && run.consumedMaterials.length > 0 && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center mb-1.5">
                          <ArrowDownRight size={12} className="mr-1 text-emerald-600" />
                          Automatically Deducted Raw Materials:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {run.consumedMaterials.map((mat, mIdx) => (
                            <span 
                              key={mIdx}
                              className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg shadow-2xs"
                            >
                              <strong className="text-indigo-700">-{mat.deducted} {mat.unit}</strong> {mat.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metric bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold">Produced</span>
                        <div className="text-lg font-black text-slate-900">
                          {producedNum} <span className="text-xs font-bold text-slate-400">/ {targetNum} units</span>
                        </div>
                      </div>

                      {run.notes && (
                        <p className="text-[11px] text-slate-500 max-w-[55%] text-right truncate italic">
                          "{run.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: RECIPES (Product Recipes & Formulas) */}
      {activeTab === 'RECIPES' && (
        <div className="space-y-4">
          {/* Header search bar */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search recipes by product name or SKU..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>
          </div>

          {filteredRecipes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <BookOpen size={36} className="mx-auto text-slate-300" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Product Recipes Defined</h4>
                <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
                  Define recipes linking your finished products to raw material consumption. When a batch is produced, required raw materials automatically decrease from warehouse inventory.
                </p>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowAddRecipeModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              >
                <Plus size={15} />
                <span>Create First Product Recipe</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredRecipes.map((recipe) => {
                const capacity = getRecipeCapacity(recipe);
                const hasCapacity = capacity.units > 0;

                return (
                  <div key={recipe.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col justify-between space-y-3">
                    <div>
                      {/* Top card header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              {recipe.sku || 'RECIPE'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              Output: 1 {recipe.outputUnit || 'unit'}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-slate-900 mt-1">{recipe.name}</h4>
                          {recipe.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{recipe.description}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartEditRecipe(recipe)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 transition cursor-pointer"
                            title="Edit Recipe Formula"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                            title="Delete Recipe"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Live Max Batch Capacity Pill */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5">
                          <Boxes size={14} className={hasCapacity ? 'text-indigo-600' : 'text-amber-600'} />
                          <span className="font-semibold text-slate-700">Warehouse Capacity:</span>
                        </div>
                        <span className={`font-black px-2 py-0.5 rounded-md ${
                          hasCapacity ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {capacity.units} {recipe.outputUnit || 'units'} max
                        </span>
                      </div>

                      {/* Ingredients formula table */}
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Bill of Materials ({recipe.ingredients?.length || 0} items)
                        </span>
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                          {Array.isArray(recipe.ingredients) && recipe.ingredients.map((ing, idx) => {
                            if (!ing) return null;
                            const mat = (materials || []).find(m => 
                              m && (
                                (m.id && ing.materialId && m.id === ing.materialId) || 
                                (m.name && ing.materialName && String(m.name).toLowerCase() === String(ing.materialName).toLowerCase())
                              )
                            );
                            const stock = mat ? Number(mat.quantity) || 0 : 0;
                            const isLow = stock <= (Number(mat?.minThreshold) || 50);

                            return (
                              <div key={idx} className="p-2 bg-white flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-bold text-slate-800">{mat ? mat.name : (ing.materialName || 'Material')}</p>
                                  <p className="text-[10px] text-slate-400">Formula: {ing.qtyPerUnit} {ing.unit || mat?.unit || ''} / unit</p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-[11px] font-bold ${isLow ? 'text-amber-600' : 'text-slate-600'}`}>
                                    Stock: {stock} {mat?.unit || ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Quick Produce Button */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          const rawName = recipe?.name || recipe?.product || 'RCP';
                          const prefix = (rawName.replace(/[^a-zA-Z0-9]/g, '') || 'BATCH').slice(0, 3).toUpperCase();
                          setNewRun(prev => ({
                            ...prev,
                            recipeId: recipe.id,
                            batch: `Batch #${prefix}-${Date.now().toString().slice(-4)}`,
                            target: prev.target || dailyTarget || 500,
                            produced: ''
                          }));
                          setShowLogModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 text-xs font-bold transition flex items-center justify-center space-x-1.5"
                      >
                        <Play size={13} className="fill-indigo-700" />
                        <span>Log Production Run for this Recipe</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MACHINES (Fleet & Downtime) */}
      {activeTab === 'MACHINES' && (
        <div className="space-y-4">
          {machines.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <Cpu size={36} className="mx-auto text-slate-300" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Machines Registered</h4>
                <p className="text-xs text-slate-500 mt-0.5">Add your plant machinery, CNC lines, cutters, or assembly cells.</p>
              </div>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddMachineModal(true); }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              >
                <Plus size={15} />
                <span>Add First Machine Asset</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {machines.map((mach) => {
                const isRunning = mach.status === 'Running';
                const isMaint = mach.status === 'Maintenance';
                const isIdle = mach.status === 'Idle';

                return (
                  <div key={mach.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {mach.code}
                          </span>
                          <button
                            onClick={() => handleToggleMachineStatus(mach.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition active:scale-95 flex items-center space-x-1 ${
                              isRunning ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isMaint ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              isIdle ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{mach.status}</span>
                          </button>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2">{mach.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{mach.type} • Prev Service: {mach.lastService}</p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartEditMachine(mach)}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                          title="Edit Machine"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteMachine(mach.id, mach.name)}
                          className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Machine"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="flex items-center font-semibold text-slate-600">
                        <Activity size={13} className="mr-1 text-blue-600" /> Uptime: <strong>{mach.uptime}</strong>
                      </span>
                      <span className="flex items-center font-semibold text-slate-600">
                        <Thermometer size={13} className="mr-1 text-amber-600" /> Core: <strong>{mach.temp}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Downtime Incidents List */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
              <Wrench size={16} className="mr-2 text-rose-600" /> Recent Downtime Incident Logs
            </h3>
            {downtimeLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No downtime incidents recorded. Fleet operating smoothly.</p>
            ) : (
              <div className="space-y-2.5">
                {downtimeLogs.map((dt) => (
                  <div key={dt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{dt.machineName}: {dt.reason}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Resolved by {dt.resolvedBy} on {dt.date}</p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black px-2 py-1 bg-rose-100 text-rose-800 rounded-lg">
                        {dt.durationMinutes} min
                      </span>
                      <button
                        onClick={() => handleStartEditDowntime(dt)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                        title="Edit Incident"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteDowntime(dt.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition cursor-pointer"
                        title="Delete Incident"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Log Production Run (with Recipe Selection & Real-Time Auto-Deduction Preview) */}
      {showLogModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Factory size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Record Production Run</h3>
              </div>
              <button type="button" onClick={() => setShowLogModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleLogRun} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Batch Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. Batch #A-108"
                  value={newRun.batch}
                  onChange={(e) => setNewRun({ ...newRun, batch: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Advanced Visual Product Recipe Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Product Formula / Recipe
                  </label>
                  <button 
                    type="button"
                    onClick={() => { setShowLogModal(false); setActiveTab('RECIPES'); }}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    + Manage Recipes
                  </button>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {/* Option: Manual Run */}
                  <div
                    onClick={() => { triggerHaptic('light'); setNewRun({ ...newRun, recipeId: '' }); }}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      !newRun.recipeId
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Factory size={15} className={!newRun.recipeId ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Manual Run (No Recipe / No Inventory Deduction)</span>
                    </div>
                    {!newRun.recipeId && <Check size={14} className="text-indigo-600" />}
                  </div>

                  {/* Recipe Cards with Live Stock Sufficiency Preview */}
                  {recipes.map(r => {
                    const cap = getRecipeCapacity(r);
                    const isSelected = newRun.recipeId === r.id;
                    const hasCap = cap.units > 0;

                    return (
                      <div
                        key={r.id}
                        onClick={() => { triggerHaptic('light'); setNewRun({ ...newRun, recipeId: r.id }); }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <Layers size={14} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className="truncate font-semibold">{r.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({r.sku || 'SKU'})</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {r.ingredients?.length || 0} raw materials linked
                          </span>
                        </div>

                        <div className="shrink-0 text-right flex items-center space-x-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            hasCap ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {hasCap ? `⚡ Max ${cap.units}` : '⚠️ Shortage'}
                          </span>
                          {isSelected && <Check size={14} className="text-indigo-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Recipe Deduction Preview */}
              {selectedRunRecipe && (
                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-indigo-950">
                    <span className="flex items-center">
                      <Layers size={14} className="mr-1.5 text-indigo-600" />
                      Formula: {selectedRunRecipe.name}
                    </span>
                    <span className="text-[11px] text-indigo-700 font-medium">Per 1 {selectedRunRecipe.outputUnit || 'unit'}</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Raw Materials Impact Preview:
                    </p>
                    {Array.isArray(selectedRunRecipe.ingredients) && selectedRunRecipe.ingredients.map((ing, idx) => {
                      if (!ing) return null;
                      const mat = (materials || []).find(m => 
                        m && (
                          (m.id && ing.materialId && m.id === ing.materialId) || 
                          (m.name && ing.materialName && String(m.name).toLowerCase() === String(ing.materialName).toLowerCase())
                        )
                      );
                      const inStock = mat ? (Number(mat.quantity) || 0) : 0;
                      const willDeduct = (Number(ing.qtyPerUnit) || 0) * (Number(newRun.produced) || 0);
                      const isShortage = inStock < willDeduct;

                      return (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-xl border border-indigo-100 text-[11px]">
                          <div>
                            <span className="font-bold text-slate-800">{mat ? mat.name : (ing.materialName || 'Material')}</span>
                            <span className="text-slate-400 ml-1.5">({ing.qtyPerUnit} {ing.unit || mat?.unit || ''}/unit)</span>
                          </div>
                          <div className="text-right">
                            {Number(newRun.produced) > 0 ? (
                              <div>
                                <span className={`font-black ${isShortage ? 'text-rose-600' : 'text-indigo-600'}`}>
                                  -{willDeduct} {ing.unit || mat?.unit || ''}
                                </span>
                                <span className="text-slate-400 ml-1 font-medium">
                                  ({inStock} → {Math.max(0, inStock - willDeduct)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-medium">Available: {inStock} {mat?.unit || ''}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Number(newRun.produced) > 0 && (
                    <div className="text-[10px] text-indigo-800 bg-indigo-100/60 p-2 rounded-lg font-medium flex items-center space-x-1.5">
                      <Sparkles size={12} className="text-indigo-600 shrink-0" />
                      <span>
                        Producing <strong>{newRun.produced} {selectedRunRecipe.outputUnit || 'units'}</strong> will automatically decrease warehouse raw materials accordingly.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Quota</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={newRun.target}
                    onChange={(e) => setNewRun({ ...newRun, target: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Actual Produced *</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={newRun.produced}
                    onChange={(e) => setNewRun({ ...newRun, produced: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Defective / Scrap Units</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newRun.defective}
                  onChange={(e) => setNewRun({ ...newRun, defective: e.target.value })}
                  min="0"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Assigned Machine Visual Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Assigned Machine Asset
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {machines.length === 0 ? (
                    <div className="col-span-2 p-2.5 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                      General Production Line (No assets registered)
                    </div>
                  ) : (
                    machines.map(m => {
                      const isSelected = newRun.machineId === m.id;
                      const isRunning = m.status === 'Running';
                      const isMaint = m.status === 'Maintenance';

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { triggerHaptic('light'); setNewRun({ ...newRun, machineId: m.id }); }}
                          className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              {m.code}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              isRunning ? 'bg-emerald-500 animate-pulse' : isMaint ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                          </div>
                          <span className="text-xs truncate block">{m.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{m.temp || 'Core Temp'}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Visual Shift Segmented Control with Live Indicator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Shift Schedule
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning', label: 'Morning', time: '06:00 - 14:00', icon: Sun },
                    { id: 'Day', label: 'Day', time: '14:00 - 22:00', icon: Sunset },
                    { id: 'Night', label: 'Night', time: '22:00 - 06:00', icon: Moon }
                  ].map(s => {
                    const isSelected = newRun.shift === s.id;
                    const isCurrent = getCurrentShift() === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setNewRun({ ...newRun, shift: s.id }); }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                          {isCurrent && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                              Live
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold block">{s.label}</span>
                        <span className="text-[9px] text-slate-400">{s.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Operator Name & On-Duty Quick Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Operator Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Kane"
                  value={newRun.operator}
                  onChange={(e) => setNewRun({ ...newRun, operator: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
                {/* Quick Staff Selection Chips */}
                {staffList.length > 0 && (
                  <div className="flex items-center space-x-1.5 overflow-x-auto pt-1.5 no-scrollbar">
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">On Duty:</span>
                    {staffList
                      .filter(st => st.status === 'On Duty')
                      .slice(0, 5)
                      .map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => { triggerHaptic('light'); setNewRun({ ...newRun, operator: st.name }); }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
                            newRun.operator === st.name
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          👤 {st.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Batch Spec</label>
                <input
                  type="text"
                  placeholder="e.g. Zero defects, on-spec"
                  value={newRun.notes}
                  onChange={(e) => setNewRun({ ...newRun, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
                >
                  Confirm & Deduct Materials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Define Product Recipe */}
      {showAddRecipeModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Layers size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Define Product Recipe Formula</h3>
              </div>
              <button type="button" onClick={() => setShowAddRecipeModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateRecipe} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Hydraulic Cylinder Model HC-50"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Recipe / Product SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. RCP-HC-50"
                    value={newRecipe.sku}
                    onChange={(e) => setNewRecipe({ ...newRecipe, sku: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Output Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. units, pcs, kg"
                    value={newRecipe.outputUnit}
                    onChange={(e) => setNewRecipe({ ...newRecipe, outputUnit: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Specification / Formula Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Standard shop floor bill of materials"
                  value={newRecipe.description}
                  onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Dynamic Ingredients Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center">
                    <Boxes size={14} className="mr-1 text-indigo-600" />
                    Bill of Raw Materials (Per 1 {newRecipe.outputUnit || 'unit'})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center"
                  >
                    <Plus size={14} className="mr-0.5" /> Add Material
                  </button>
                </div>

                {materials.length === 0 && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 mb-2">
                    <p className="font-semibold">⚠️ No Raw Materials registered yet in warehouse.</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">You can enter material names below, and register them in the Raw Materials tab.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {newRecipe.ingredients.map((ing, idx) => {
                    const selectedMat = materials.find(m => m.id === ing.materialId);

                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Raw Material</label>
                          {materials.length > 0 ? (
                            <SearchableMaterialSelect
                              value={ing.materialId}
                              onChange={(matId) => handleIngredientChange(idx, 'materialId', matId)}
                              materials={materials}
                              placeholder="-- Search & Choose Material --"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Material Name"
                              value={ing.materialName}
                              onChange={(e) => handleIngredientChange(idx, 'materialName', e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                            />
                          )}
                        </div>

                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Qty / Unit</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Qty"
                            value={ing.qtyPerUnit}
                            onChange={(e) => handleIngredientChange(idx, 'qtyPerUnit', e.target.value)}
                            min="0.001"
                            required
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div className="w-16">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Unit</label>
                          <span className="block p-2 text-xs font-bold text-slate-600 bg-slate-200/50 rounded-lg text-center truncate">
                            {selectedMat?.unit || ing.unit || 'units'}
                          </span>
                        </div>

                        {newRecipe.ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientRow(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 self-end"
                            title="Remove Ingredient"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
                >
                  Save Product Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Log Downtime Incident Modal */}
      {showDowntimeModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Log Machine Downtime</h3>
              <button type="button" onClick={() => setShowDowntimeModal(false)} className="p-1 rounded-full text-slate-400">✕</button>
            </div>

            <form onSubmit={handleLogDowntime} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Machine Asset</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {machines.length === 0 ? (
                    <div className="col-span-2 p-2.5 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                      General Production Line (No assets registered)
                    </div>
                  ) : (
                    machines.map(m => {
                      const isSelected = newIncident.machineId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { triggerHaptic('light'); setNewIncident({ ...newIncident, machineId: m.id }); }}
                          className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-500 text-rose-950 font-bold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              {m.code}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{m.status}</span>
                          </div>
                          <span className="text-xs truncate block">{m.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Downtime Duration (Minutes) *</label>
                <input
                  type="number"
                  value={newIncident.durationMinutes}
                  onChange={(e) => setNewIncident({ ...newIncident, durationMinutes: e.target.value })}
                  required
                  min="1"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Root Cause / Stoppage Reason *</label>
                <input
                  type="text"
                  placeholder="e.g. Hydraulic line pressure loss"
                  value={newIncident.reason}
                  onChange={(e) => setNewIncident({ ...newIncident, reason: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technician / Lead</label>
                <input
                  type="text"
                  placeholder="Lead technician"
                  value={newIncident.resolvedBy}
                  onChange={(e) => setNewIncident({ ...newIncident, resolvedBy: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/25 active:scale-95 transition"
                >
                  Record Downtime Stoppage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Machine Asset Modal */}
      {showAddMachineModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Machine Asset</h3>
              <button type="button" onClick={() => setShowAddMachineModal(false)} className="p-1 rounded-full text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddMachine} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Asset Code *</label>
                <input
                  type="text"
                  placeholder="e.g. CNC-01 or LINE-A"
                  value={newMachine.code}
                  onChange={(e) => setNewMachine({ ...newMachine, code: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Machine Name *</label>
                <input
                  type="text"
                  placeholder="e.g. 5-Axis Milling Center"
                  value={newMachine.name}
                  onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Process Classification</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'Machining', label: 'Machining', icon: '⚙️' },
                    { id: 'Assembly', label: 'Assembly', icon: '🧩' },
                    { id: 'Welding', label: 'Welding', icon: '⚡' },
                    { id: 'Cutting', label: 'Cutting', icon: '✂️' },
                    { id: 'Packaging', label: 'Packaging', icon: '📦' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewMachine({ ...newMachine, type: t.id }); }}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                        newMachine.type === t.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nominal Temp</label>
                <input
                  type="text"
                  placeholder="e.g. 38°C"
                  value={newMachine.temp}
                  onChange={(e) => setNewMachine({ ...newMachine, temp: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-95 transition"
                >
                  Register Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL 1: Edit Production Run */}
      {editingRun && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Pencil size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Production Run</h3>
              </div>
              <button type="button" onClick={() => setEditingRun(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditRun} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Batch Identifier *</label>
                <input
                  type="text"
                  value={editingRun.batch}
                  onChange={(e) => setEditingRun({ ...editingRun, batch: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Product Recipe Formula</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  <div
                    onClick={() => { triggerHaptic('light'); setEditingRun({ ...editingRun, recipeId: '' }); }}
                    className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      !editingRun.recipeId
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Manual Run (No Recipe Linked)</span>
                    {!editingRun.recipeId && <Check size={14} className="text-indigo-600" />}
                  </div>
                  {recipes.map(r => (
                    <div
                      key={r.id}
                      onClick={() => { triggerHaptic('light'); setEditingRun({ ...editingRun, recipeId: r.id }); }}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        editingRun.recipeId === r.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <Layers size={13} className={editingRun.recipeId === r.id ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="font-semibold truncate">{r.name}</span>
                      </div>
                      {editingRun.recipeId === r.id && <Check size={14} className="text-indigo-600 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Produced *</label>
                  <input
                    type="number"
                    value={editingRun.produced}
                    onChange={(e) => setEditingRun({ ...editingRun, produced: e.target.value })}
                    required
                    min="0"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target</label>
                  <input
                    type="number"
                    value={editingRun.target}
                    onChange={(e) => setEditingRun({ ...editingRun, target: e.target.value })}
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Scrap / Defect</label>
                  <input
                    type="number"
                    value={editingRun.defective}
                    onChange={(e) => setEditingRun({ ...editingRun, defective: e.target.value })}
                    min="0"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning', label: 'Morning', icon: Sun },
                    { id: 'Day', label: 'Day', icon: Sunset },
                    { id: 'Night', label: 'Night', icon: Moon }
                  ].map(s => {
                    const isSelected = editingRun.shift === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingRun({ ...editingRun, shift: s.id }); }}
                        className={`p-2 rounded-xl border text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={14} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="text-xs">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Operator</label>
                <input
                  type="text"
                  value={editingRun.operator}
                  onChange={(e) => setEditingRun({ ...editingRun, operator: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={editingRun.notes}
                  onChange={(e) => setEditingRun({ ...editingRun, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingRun(null)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition cursor-pointer"
                >
                  Save Run Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL 2: Edit Product Recipe */}
      {editingRecipe && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Pencil size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Product Recipe Formula</h3>
              </div>
              <button type="button" onClick={() => setEditingRecipe(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditRecipe} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Name *</label>
                <input
                  type="text"
                  value={editingRecipe.name}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Recipe SKU</label>
                  <input
                    type="text"
                    value={editingRecipe.sku}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, sku: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Output Unit</label>
                  <input
                    type="text"
                    value={editingRecipe.outputUnit}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, outputUnit: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Specification Notes</label>
                <input
                  type="text"
                  value={editingRecipe.description}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Dynamic Ingredients Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center">
                    <Boxes size={14} className="mr-1 text-indigo-600" />
                    Bill of Raw Materials (Per 1 {editingRecipe.outputUnit || 'unit'})
                  </label>
                  <button
                    type="button"
                    onClick={handleEditRecipeAddIngredient}
                    className="text-xs text-indigo-600 font-bold hover:underline flex items-center cursor-pointer"
                  >
                    <Plus size={13} className="mr-0.5" /> Add Material
                  </button>
                </div>

                <div className="space-y-2">
                  {editingRecipe.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <SearchableMaterialSelect
                          value={ing.materialId}
                          onChange={(matId) => handleEditRecipeIngredientChange(idx, 'materialId', matId)}
                          materials={materials}
                          placeholder="-- Search & Choose Raw Material --"
                        />
                      </div>

                      <div className="w-24 flex items-center space-x-1">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          placeholder="Qty"
                          value={ing.qtyPerUnit}
                          onChange={(e) => handleEditRecipeIngredientChange(idx, 'qtyPerUnit', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-600 text-center"
                        />
                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{ing.unit}</span>
                      </div>

                      {editingRecipe.ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEditRecipeRemoveIngredient(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingRecipe(null)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition cursor-pointer"
                >
                  Save Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL 3: Edit Machine Asset */}
      {editingMachine && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Machine Asset</h3>
              <button type="button" onClick={() => setEditingMachine(null)} className="p-1 rounded-full text-slate-400 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditMachine} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Asset Code *</label>
                <input
                  type="text"
                  value={editingMachine.code}
                  onChange={(e) => setEditingMachine({ ...editingMachine, code: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Machine Name *</label>
                <input
                  type="text"
                  value={editingMachine.name}
                  onChange={(e) => setEditingMachine({ ...editingMachine, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Process Classification</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'Machining', label: 'Machining', icon: '⚙️' },
                    { id: 'Assembly', label: 'Assembly', icon: '🧩' },
                    { id: 'Welding', label: 'Welding', icon: '⚡' },
                    { id: 'Cutting', label: 'Cutting', icon: '✂️' },
                    { id: 'Packaging', label: 'Packaging', icon: '📦' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setEditingMachine({ ...editingMachine, type: t.id }); }}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                        editingMachine.type === t.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Operational Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Running', label: 'Running', color: 'bg-emerald-500' },
                    { id: 'Idle', label: 'Idle', color: 'bg-amber-500' },
                    { id: 'Maintenance', label: 'Maintenance', color: 'bg-rose-500' },
                    { id: 'Offline', label: 'Offline', color: 'bg-slate-500' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setEditingMachine({ ...editingMachine, status: st.id }); }}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                        editingMachine.status === st.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${st.color}`} />
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nominal Temp</label>
                  <input
                    type="text"
                    value={editingMachine.temp}
                    onChange={(e) => setEditingMachine({ ...editingMachine, temp: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Uptime Rate</label>
                  <input
                    type="text"
                    value={editingMachine.uptime}
                    onChange={(e) => setEditingMachine({ ...editingMachine, uptime: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingMachine(null)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition cursor-pointer"
                >
                  Save Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL 4: Edit Downtime Incident */}
      {editingDowntime && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Downtime Stoppage</h3>
              <button type="button" onClick={() => setEditingDowntime(null)} className="p-1 rounded-full text-slate-400 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditDowntime} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Machine Asset</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {machines.map(m => {
                    const isSelected = editingDowntime.machineId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setEditingDowntime({ ...editingDowntime, machineId: m.id }); }}
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-500 text-rose-950 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                            {m.code}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{m.status}</span>
                        </div>
                        <span className="text-xs truncate block">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Downtime Duration (Minutes) *</label>
                <input
                  type="number"
                  value={editingDowntime.durationMinutes}
                  onChange={(e) => setEditingDowntime({ ...editingDowntime, durationMinutes: e.target.value })}
                  required
                  min="1"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Root Cause / Reason *</label>
                <input
                  type="text"
                  value={editingDowntime.reason}
                  onChange={(e) => setEditingDowntime({ ...editingDowntime, reason: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technician / Lead</label>
                <input
                  type="text"
                  value={editingDowntime.resolvedBy}
                  onChange={(e) => setEditingDowntime({ ...editingDowntime, resolvedBy: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingDowntime(null)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-xl shadow-rose-500/30 active:scale-95 transition cursor-pointer"
                >
                  Save Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK MODAL 1: Bulk Reassign Shift for Runs */}
      {showBulkRunShiftModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sun size={18} className="text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Bulk Reassign Shift</h3>
              </div>
              <button onClick={() => setShowBulkRunShiftModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkReassignRunShift} className="space-y-4 mt-4">
              <p className="text-xs text-slate-500">
                Reassigning shift schedule for <strong>{selectedRunIds.length}</strong> selected production runs:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Morning', label: 'Morning', time: '06:00 - 14:00', icon: Sun },
                  { id: 'Day', label: 'Day', time: '14:00 - 22:00', icon: Sunset },
                  { id: 'Night', label: 'Night', time: '22:00 - 06:00', icon: Moon }
                ].map(s => {
                  const isSelected = bulkRunShiftValue === s.id;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setBulkRunShiftValue(s.id); }}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={18} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="text-xs">{s.label}</span>
                      <span className="text-[9px] text-slate-400">{s.time}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkRunShiftModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
                >
                  Apply to {selectedRunIds.length} Runs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK MODAL 2: Bulk Set Machine Status */}
      {showBulkMachineStatusModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Activity size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Bulk Update Machine Fleet</h3>
              </div>
              <button onClick={() => setShowBulkMachineStatusModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4 mt-4">
              <p className="text-xs text-slate-500">
                Change operational status for <strong>{selectedMachineIds.length}</strong> selected machines:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Running', label: 'Running', color: 'bg-emerald-500' },
                  { id: 'Idle', label: 'Idle', color: 'bg-amber-500' },
                  { id: 'Maintenance', label: 'Maintenance', color: 'bg-rose-500' },
                  { id: 'Offline', label: 'Offline', color: 'bg-slate-500' }
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => handleBulkSetMachineStatus(st.id)}
                    className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center space-x-2.5 active:scale-95 cursor-pointer text-left"
                  >
                    <span className={`w-3 h-3 rounded-full ${st.color}`} />
                    <span className="text-xs font-bold text-slate-800">Set {st.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BULK SELECTION TOOLBARS */}
      {activeTab === 'RUNS' && selectedRunIds.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedRunIds.length}
          totalCount={filteredRuns.length}
          onSelectAll={handleSelectAllRuns}
          onDeselectAll={handleDeselectAllRuns}
          onCancel={() => { setIsRunSelectMode(false); setSelectedRunIds([]); }}
          actions={[
            {
              label: 'Shift',
              icon: Sun,
              onClick: () => setShowBulkRunShiftModal(true)
            },
            {
              label: 'Export',
              icon: Share2,
              onClick: handleBulkExportRuns
            },
            {
              label: 'Delete',
              icon: Trash2,
              variant: 'danger',
              onClick: handleBulkDeleteRuns
            }
          ]}
        />
      )}

      {activeTab === 'MACHINES' && selectedMachineIds.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedMachineIds.length}
          totalCount={filteredMachines.length}
          onSelectAll={handleSelectAllMachines}
          onDeselectAll={handleDeselectAllMachines}
          onCancel={() => { setIsMachineSelectMode(false); setSelectedMachineIds([]); }}
          actions={[
            {
              label: 'Set Status',
              icon: Activity,
              onClick: () => setShowBulkMachineStatusModal(true)
            },
            {
              label: 'Export',
              icon: Share2,
              onClick: handleBulkExportMachines
            },
            {
              label: 'Delete',
              icon: Trash2,
              variant: 'danger',
              onClick: handleBulkDeleteMachines
            }
          ]}
        />
      )}

      {activeTab === 'RECIPES' && selectedRecipeIds.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedRecipeIds.length}
          totalCount={filteredRecipes.length}
          onSelectAll={handleSelectAllRecipes}
          onDeselectAll={handleDeselectAllRecipes}
          onCancel={() => { setIsRecipeSelectMode(false); setSelectedRecipeIds([]); }}
          actions={[
            {
              label: 'Export',
              icon: Share2,
              onClick: handleBulkExportRecipes
            },
            {
              label: 'Delete',
              icon: Trash2,
              variant: 'danger',
              onClick: handleBulkDeleteRecipes
            }
          ]}
        />
      )}
    </div>
  );
}
