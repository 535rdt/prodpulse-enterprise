import React, { useState, useEffect, useMemo } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { 
  Boxes, Plus, Search, Trash2, Camera as CameraIcon, 
  Share2, AlertTriangle, X, Eye, QrCode, ShoppingCart,
  MapPin, Tag, RefreshCw, Pencil, PackagePlus, PlusCircle, 
  ArrowDownToLine, CheckSquare, Square, ArrowUpDown, Layers,
  Check, Filter, AlertOctagon, CheckCircle2, ChevronDown,
  Table, LayoutGrid
} from 'lucide-react';
import { 
  getMaterials, setMaterials, 
  getCategories, addCategory, deleteCategory, DEFAULT_CATEGORIES,
  getUnits, addUnit, deleteUnit, DEFAULT_UNITS 
} from '../utils/storage';
import { triggerHaptic, showToast, shareOrCopy } from '../utils/feedback';
import SelectionToolbar from '../components/SelectionToolbar';
import { useBackAction } from '../utils/backButton';

export default function Materials() {
  const [materials, setMaterialList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStockStatus, setFilterStockStatus] = useState('ALL'); // 'ALL' | 'LOW' | 'OUT' | 'OPTIMAL'
  const [sortBy, setSortBy] = useState('NAME_ASC'); // 'NAME_ASC' | 'NAME_DESC' | 'QTY_DESC' | 'QTY_ASC' | 'URGENCY'
  
  // Multi-Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState(null); // for Barcode/QR asset label view
  const [restockItem, setRestockItem] = useState(null); // for PO restock modal
  const [restockAmount, setRestockAmount] = useState('500');
  const [editingMat, setEditingMat] = useState(null); // material being edited

  // Dynamic Category & Unit Management State
  const [categoryPresets, setCategoryPresets] = useState(DEFAULT_CATEGORIES);
  const [unitPresets, setUnitPresets] = useState(DEFAULT_UNITS);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitGroup, setNewUnitGroup] = useState('Custom');

  // Table View & Interactive Category Column State
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'CARDS'
  const [isCategoryHeaderDropdownOpen, setIsCategoryHeaderDropdownOpen] = useState(false);
  const [activeCategoryRowId, setActiveCategoryRowId] = useState(null);
  const [pendingCategoryMatId, setPendingCategoryMatId] = useState(null);

  // Bulk Operations Modals
  const [showBulkStockModal, setShowBulkStockModal] = useState(false);
  const [bulkStockAddQty, setBulkStockAddQty] = useState('100');
  const [showBulkLocationModal, setShowBulkLocationModal] = useState(false);
  const [bulkLocationValue, setBulkLocationValue] = useState('Warehouse Bay 1');
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkCategoryValue, setBulkCategoryValue] = useState('Metals');

  // Single Item Add Stock Modal State
  const [stockItem, setStockItem] = useState(null);
  const [stockAddQty, setStockAddQty] = useState('100');
  const [stockPO, setStockPO] = useState('');
  const [stockSupplier, setStockSupplier] = useState('');
  const [stockUnitCost, setStockUnitCost] = useState('');
  const [stockLocation, setStockLocation] = useState('');
  const [stockNotes, setStockNotes] = useState('');

  // Hardware Back Button Handlers
  const isAnyModalOpen = showAddModal || !!selectedLabel || !!restockItem || !!editingMat ||
    showAddCategoryModal || showAddUnitModal || showBulkStockModal || showBulkLocationModal ||
    showBulkCategoryModal || !!stockItem || !!previewImage || isCategoryHeaderDropdownOpen ||
    !!activeCategoryRowId || !!pendingCategoryMatId;

  useBackAction(() => {
    if (previewImage) { setPreviewImage(null); return true; }
    if (isCategoryHeaderDropdownOpen) { setIsCategoryHeaderDropdownOpen(false); return true; }
    if (activeCategoryRowId) { setActiveCategoryRowId(null); return true; }
    if (pendingCategoryMatId) { setPendingCategoryMatId(null); return true; }
    if (showAddModal) { setShowAddModal(false); return true; }
    if (selectedLabel) { setSelectedLabel(null); return true; }
    if (restockItem) { setRestockItem(null); return true; }
    if (editingMat) { setEditingMat(null); return true; }
    if (showAddCategoryModal) { setShowAddCategoryModal(false); return true; }
    if (showAddUnitModal) { setShowAddUnitModal(false); return true; }
    if (showBulkStockModal) { setShowBulkStockModal(false); return true; }
    if (showBulkLocationModal) { setShowBulkLocationModal(false); return true; }
    if (showBulkCategoryModal) { setShowBulkCategoryModal(false); return true; }
    if (stockItem) { setStockItem(null); return true; }
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

  // Clear active filters before navigating away
  useBackAction(() => {
    if (searchQuery || filterCategory !== 'ALL' || filterStockStatus !== 'ALL') {
      triggerHaptic('light');
      setSearchQuery('');
      setFilterCategory('ALL');
      setFilterStockStatus('ALL');
      return true;
    }
    return false;
  }, !!searchQuery || filterCategory !== 'ALL' || filterStockStatus !== 'ALL', 70);

  // New Material Form State
  const [newMat, setNewMat] = useState({
    name: '',
    sku: '',
    category: 'Metals',
    quantity: '',
    unit: 'kg',
    minThreshold: '',
    cost: '',
    location: 'Bay A-1',
    receiptImage: null
  });

  const loadData = async () => {
    try {
      const list = await getMaterials();
      const cats = await getCategories();
      const unts = await getUnits();
      setMaterialList(Array.isArray(list) ? list : []);
      setCategoryPresets(Array.isArray(cats) && cats.length > 0 ? cats : DEFAULT_CATEGORIES);
      setUnitPresets(Array.isArray(unts) && unts.length > 0 ? unts : DEFAULT_UNITS);
    } catch (err) {
      console.error('Error loading materials, categories or units:', err);
      setMaterialList([]);
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
    setMaterialList(updated);
    await setMaterials(updated);
  };

  // Category & Unit Management Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      await showToast('Please enter a category name');
      return;
    }
    await triggerHaptic('success');
    const label = newCatName.trim();
    const updated = await addCategory({
      id: label,
      label,
      icon: newCatIcon || '🏷️',
      color: 'blue'
    });
    setCategoryPresets(updated);
    if (showAddModal) {
      setNewMat(prev => ({ ...prev, category: label }));
    }
    if (editingMat) {
      setEditingMat(prev => ({ ...prev, category: label }));
    }
    if (showBulkCategoryModal) {
      setBulkCategoryValue(label);
    }
    // If created from an item row's category dropdown, automatically assign it to that item
    if (pendingCategoryMatId) {
      const updatedMats = materials.map(m => m.id === pendingCategoryMatId ? { ...m, category: label } : m);
      await saveAndSync(updatedMats);
      setPendingCategoryMatId(null);
    }
    setFilterCategory(label);
    setShowAddCategoryModal(false);
    setNewCatName('');
    setNewCatIcon('🏷️');
    await showToast(`New category "${label}" added and active!`);
  };

  const handleUpdateItemCategory = async (matId, newCategory) => {
    await triggerHaptic('light');
    const updated = materials.map(m => m.id === matId ? { ...m, category: newCategory } : m);
    await saveAndSync(updated);
    await showToast(`Updated category to "${newCategory}"`);
  };

  const handleDeleteCategory = async (catId) => {
    if (window.confirm(`Delete category "${catId}"? Items using this category will retain it.`)) {
      await triggerHaptic('heavy');
      const updated = await deleteCategory(catId);
      setCategoryPresets(updated);
      if (filterCategory === catId) setFilterCategory('ALL');
      await showToast(`Category "${catId}" removed`);
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnitName.trim()) {
      await showToast('Please enter unit measurement symbol/name');
      return;
    }
    await triggerHaptic('success');
    const unitSymbol = newUnitName.trim().toLowerCase();
    const updated = await addUnit(unitSymbol, newUnitGroup || 'Custom');
    setUnitPresets(updated);
    if (showAddModal) {
      setNewMat(prev => ({ ...prev, unit: unitSymbol }));
    }
    if (editingMat) {
      setEditingMat(prev => ({ ...prev, unit: unitSymbol }));
    }
    setShowAddUnitModal(false);
    setNewUnitName('');
    await showToast(`New unit "${unitSymbol}" created and selected!`);
  };

  const handleDeleteUnit = async (unitSymbol) => {
    if (window.confirm(`Delete unit "${unitSymbol}"?`)) {
      await triggerHaptic('heavy');
      const updated = await deleteUnit(unitSymbol);
      setUnitPresets(updated);
      await showToast(`Unit "${unitSymbol}" removed`);
    }
  };

  // Selection Handlers
  const toggleSelect = (id) => {
    triggerHaptic('light');
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    triggerHaptic('light');
    setSelectedIds(filteredMaterials.map(m => m.id));
  };

  const handleDeselectAll = () => {
    triggerHaptic('light');
    setSelectedIds([]);
  };

  // Bulk Operations
  const handleBulkAddStock = async (e) => {
    e.preventDefault();
    const addQty = Number(bulkStockAddQty);
    if (!addQty || addQty <= 0) return;

    await triggerHaptic('success');
    const updated = materials.map(m => {
      if (selectedIds.includes(m.id)) {
        return {
          ...m,
          quantity: (Number(m.quantity) || 0) + addQty,
          lastPurchase: new Date().toISOString().split('T')[0]
        };
      }
      return m;
    });

    await saveAndSync(updated);
    setShowBulkStockModal(false);
    await showToast(`+${addQty} units added to ${selectedIds.length} selected materials!`);
    setSelectedIds([]);
  };

  const handleBulkSetLocation = async (e) => {
    e.preventDefault();
    if (!bulkLocationValue.trim()) return;

    await triggerHaptic('success');
    const updated = materials.map(m => {
      if (selectedIds.includes(m.id)) {
        return { ...m, location: bulkLocationValue.trim() };
      }
      return m;
    });

    await saveAndSync(updated);
    setShowBulkLocationModal(false);
    await showToast(`Location updated to "${bulkLocationValue}" for ${selectedIds.length} items!`);
    setSelectedIds([]);
  };

  const handleBulkSetCategory = async (e) => {
    e.preventDefault();
    await triggerHaptic('success');
    const updated = materials.map(m => {
      if (selectedIds.includes(m.id)) {
        return { ...m, category: bulkCategoryValue };
      }
      return m;
    });

    await saveAndSync(updated);
    setShowBulkCategoryModal(false);
    await showToast(`Category set to "${bulkCategoryValue}" for ${selectedIds.length} items!`);
    setSelectedIds([]);
  };

  const handleBulkExport = async () => {
    await triggerHaptic('medium');
    const selectedItems = materials.filter(m => selectedIds.includes(m.id));
    const jsonStr = JSON.stringify(selectedItems, null, 2);
    await shareOrCopy({
      title: 'Export Selected Materials',
      text: `Export of ${selectedItems.length} selected warehouse materials.`,
      jsonString: jsonStr
    });
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedIds.length} selected materials permanently?`)) {
      await triggerHaptic('heavy');
      const updated = materials.filter(m => !selectedIds.includes(m.id));
      await saveAndSync(updated);
      setSelectedIds([]);
      await showToast(`${selectedIds.length} materials removed from inventory`);
    }
  };

  // Single Item Operations
  const handleAdjustQuantity = async (id, delta) => {
    await triggerHaptic('light');
    const updated = materials.map(m => {
      if (m && m.id === id) {
        const currentQty = Number(m.quantity) || 0;
        const nextQty = Math.max(0, currentQty + delta);
        return { ...m, quantity: nextQty };
      }
      return m;
    });
    await saveAndSync(updated);
  };

  const handleRestockPO = async (e) => {
    e.preventDefault();
    if (!restockItem || !restockAmount || Number(restockAmount) <= 0) return;

    await triggerHaptic('success');
    const addQty = Number(restockAmount);
    const updated = materials.map(m => {
      if (m.id === restockItem.id) {
        return {
          ...m,
          quantity: (Number(m.quantity) || 0) + addQty,
          lastPurchase: new Date().toISOString().split('T')[0]
        };
      }
      return m;
    });

    await saveAndSync(updated);
    setRestockItem(null);
    await showToast(`Restocked +${addQty} ${restockItem.unit} of ${restockItem.name}!`);
  };

  const handleOpenAddStock = (mat) => {
    triggerHaptic('light');
    const target = mat || (materials.length > 0 ? materials[0] : null);
    setStockItem(target);
    setStockAddQty('100');
    setStockPO('');
    setStockSupplier(target?.lastSupplier || '');
    setStockUnitCost(target?.cost ? String(target.cost).replace('$', '').trim() : '');
    setStockLocation(target?.location || '');
    setStockNotes('');
  };

  const handleConfirmAddStock = async (e) => {
    e.preventDefault();
    if (!stockItem) return;
    const addQty = Number(stockAddQty);
    if (!addQty || addQty <= 0) {
      await showToast('Please enter a valid stock quantity');
      return;
    }

    await triggerHaptic('success');
    const updated = materials.map(m => {
      if (m.id === stockItem.id) {
        const cur = Number(m.quantity) || 0;
        const newTotal = cur + addQty;
        return {
          ...m,
          quantity: newTotal,
          lastPurchase: new Date().toISOString().split('T')[0],
          lastPO: stockPO.trim() || m.lastPO,
          lastSupplier: stockSupplier.trim() || m.lastSupplier,
          cost: stockUnitCost.trim() ? `$${stockUnitCost.replace('$', '').trim()}` : m.cost,
          location: stockLocation.trim() || m.location,
          lastRestockNote: stockNotes.trim() || undefined
        };
      }
      return m;
    });

    await saveAndSync(updated);
    const targetName = stockItem.name;
    const targetUnit = stockItem.unit || 'units';
    setStockItem(null);
    await showToast(`+${addQty.toLocaleString()} ${targetUnit} added to "${targetName}"!`);
  };

  const handleStartEdit = (mat) => {
    triggerHaptic('light');
    setEditingMat({
      ...mat,
      name: mat.name || '',
      sku: mat.sku || '',
      category: mat.category || 'General',
      quantity: mat.quantity !== undefined ? mat.quantity : '',
      unit: mat.unit || 'kg',
      minThreshold: mat.minThreshold !== undefined ? mat.minThreshold : 100,
      cost: mat.cost ? String(mat.cost).replace('$', '') : '',
      location: mat.location || 'Bay A-1'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMat.name || editingMat.quantity === '') {
      await showToast('Material Name and Quantity are required');
      return;
    }

    await triggerHaptic('success');
    const updated = materials.map(m => {
      if (m.id === editingMat.id) {
        return {
          ...m,
          name: editingMat.name.trim(),
          sku: (editingMat.sku || '').trim() || m.sku,
          category: editingMat.category || 'General',
          quantity: Math.max(0, Number(editingMat.quantity) || 0),
          unit: editingMat.unit || 'kg',
          minThreshold: Math.max(0, Number(editingMat.minThreshold) || 0),
          cost: editingMat.cost ? `$${editingMat.cost.replace('$', '').trim()}` : undefined,
          location: (editingMat.location || 'Warehouse Bay 1').trim()
        };
      }
      return m;
    });

    await saveAndSync(updated);
    setEditingMat(null);
    await showToast(`Material "${editingMat.name}" updated!`);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete "${name || 'this item'}" from inventory?`)) {
      await triggerHaptic('heavy');
      const updated = materials.filter(m => m && m.id !== id);
      await saveAndSync(updated);
      setSelectedIds(prev => prev.filter(x => x !== id));
      await showToast('Material deleted from inventory');
    }
  };

  const handleScanReceipt = async () => {
    try {
      await triggerHaptic('medium');
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image && image.dataUrl) {
        setNewMat(prev => ({ ...prev, receiptImage: image.dataUrl }));
        setShowAddModal(true);
        await triggerHaptic('success');
        await showToast('Receipt captured! Complete details below.');
      }
    } catch (err) {
      console.log('Camera dismissed or unavailable:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newMat.name || !newMat.quantity) {
      await showToast('Material Name and Quantity are required');
      return;
    }

    await triggerHaptic('success');
    const skuCode = (newMat.sku || '').trim() || `SKU-${newMat.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const entry = {
      id: `MAT-${Date.now().toString().slice(-4)}`,
      sku: skuCode,
      name: (newMat.name || '').trim(),
      category: newMat.category || 'General',
      quantity: Number(newMat.quantity) || 0,
      unit: newMat.unit || 'kg',
      minThreshold: Number(newMat.minThreshold) || 100,
      cost: newMat.cost ? `$${newMat.cost.replace('$', '')}` : undefined,
      location: (newMat.location || 'Warehouse Bay 1').trim(),
      lastPurchase: new Date().toISOString().split('T')[0],
      receiptImage: newMat.receiptImage || null
    };

    const updated = [entry, ...materials];
    await saveAndSync(updated);
    setShowAddModal(false);
    setNewMat({
      name: '',
      sku: '',
      category: 'Metals',
      quantity: '',
      unit: 'kg',
      minThreshold: '',
      cost: '',
      location: 'Bay A-1',
      receiptImage: null
    });
    await showToast('New material registered into ERP stock!');
  };

  const handleExport = async () => {
    await triggerHaptic('medium');
    const jsonStr = JSON.stringify(materials, null, 2);
    await shareOrCopy({
      title: 'Raw Materials Inventory',
      text: `Inventory list containing ${materials.length} production items.`,
      jsonString: jsonStr
    });
  };

  const commonBays = ['Bay A-1', 'Bay A-2', 'Bay B-1', 'Rack C-3', 'Cold Store', 'Dock 1'];

  // Advanced Filter & Sort Pipeline
  const filteredMaterials = useMemo(() => {
    let result = (Array.isArray(materials) ? materials : []).filter(m => {
      if (!m) return false;
      const name = (m.name || '').toLowerCase();
      const sku = (m.sku || '').toLowerCase();
      const loc = (m.location || '').toLowerCase();
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = name.includes(q) || sku.includes(q) || loc.includes(q);
      if (!matchesSearch) return false;

      // Category filter
      if (filterCategory !== 'ALL' && m.category !== filterCategory) return false;

      // Stock status filter
      const qty = Number(m.quantity) || 0;
      const min = Number(m.minThreshold) || 100;
      if (filterStockStatus === 'LOW' && qty > min) return false;
      if (filterStockStatus === 'OUT' && qty > 0) return false;
      if (filterStockStatus === 'OPTIMAL' && qty <= min) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'QTY_DESC') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (sortBy === 'QTY_ASC') return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      if (sortBy === 'URGENCY') {
        const aUrgent = (Number(a.quantity) || 0) <= (Number(a.minThreshold) || 100);
        const bUrgent = (Number(b.quantity) || 0) <= (Number(b.minThreshold) || 100);
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      }
      return 0;
    });

    return result;
  }, [materials, searchQuery, filterCategory, filterStockStatus, sortBy]);

  // Bulk actions configuration for SelectionToolbar
  const bulkActions = [
    {
      label: '+Stock',
      icon: PackagePlus,
      variant: 'primary',
      onClick: () => setShowBulkStockModal(true)
    },
    {
      label: 'Bay',
      icon: MapPin,
      variant: 'default',
      onClick: () => setShowBulkLocationModal(true)
    },
    {
      label: 'Category',
      icon: Layers,
      variant: 'default',
      onClick: () => setShowBulkCategoryModal(true)
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
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Raw Materials Hub</h2>
          <p className="text-xs text-slate-500 font-medium">SKU inventory, batch selections & bin telemetry</p>
        </div>
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Multi-Selection Mode Toggle */}
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
            onClick={handleScanReceipt}
            title="Scan Receipt with Camera"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm active:scale-95 transition flex items-center space-x-1 cursor-pointer"
          >
            <CameraIcon size={16} />
            <span className="text-xs font-bold hidden sm:inline">Scan</span>
          </button>

          <button
            onClick={() => {
              if (materials.length === 0) {
                showToast('Please register a material item first');
                setShowAddModal(true);
              } else {
                handleOpenAddStock(materials[0]);
              }
            }}
            title="Add stock to already created items"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <PackagePlus size={16} />
            <span>+ Add Stock</span>
          </button>

          <button
            onClick={() => { triggerHaptic('light'); setShowAddModal(true); }}
            title="Register a new material SKU"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Advanced Search & Filtering Console */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center space-x-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by material, SKU code, or bay..."
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

          {/* Advanced Sort Selector */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => { triggerHaptic('light'); setSortBy(e.target.value); }}
              className="py-2 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NAME_ASC">Name (A-Z)</option>
              <option value="NAME_DESC">Name (Z-A)</option>
              <option value="QTY_DESC">Stock: High ➔ Low</option>
              <option value="QTY_ASC">Stock: Low ➔ High</option>
              <option value="URGENCY">Urgency / Low Stock</option>
            </select>
            <ArrowUpDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Quick Category Dropdown Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsCategoryHeaderDropdownOpen(!isCategoryHeaderDropdownOpen);
              }}
              className={`py-2 px-2.5 border rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition ${
                filterCategory !== 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Category selector with dropdown"
            >
              <Tag size={13} className={filterCategory !== 'ALL' ? 'text-white' : 'text-blue-600'} />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {filterCategory === 'ALL' ? 'Category: All' : filterCategory}
              </span>
              <span className="sm:hidden">Category</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${isCategoryHeaderDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCategoryHeaderDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsCategoryHeaderDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 mb-1">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Category Filter</span>
                    <span className="text-[10px] font-bold text-slate-500">{materials.length} total</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto px-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFilterCategory('ALL');
                        setIsCategoryHeaderDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        filterCategory === 'ALL'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-100 text-slate-700 font-medium'
                      }`}
                    >
                      <span>📁 All Categories</span>
                      <span className={`text-[10px] font-bold ${filterCategory === 'ALL' ? 'text-white/80' : 'text-slate-400'}`}>
                        ({materials.length})
                      </span>
                    </button>

                    {categoryPresets.map(cat => {
                      const count = materials.filter(m => m.category === cat.id).length;
                      const isSelected = filterCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setFilterCategory(cat.id);
                            setIsCategoryHeaderDropdownOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
                              : 'hover:bg-slate-100 text-slate-700 font-medium'
                          }`}
                        >
                          <span className="flex items-center space-x-2">
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </span>
                          <span className={`text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setIsCategoryHeaderDropdownOpen(false);
                        setShowAddCategoryModal(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left font-bold text-blue-600 bg-blue-50/70 hover:bg-blue-100 transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plus size={14} className="stroke-[2.5]" />
                      <span>+ Add New Category</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* View Mode Switcher (Table vs Cards) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setViewMode('TABLE'); }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                viewMode === 'TABLE' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View with Category Column"
            >
              <Table size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setViewMode('CARDS'); }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                viewMode === 'CARDS' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>

        {/* Stock Status Selector Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All Status' },
            { id: 'LOW', label: '⚠️ Low Stock', count: materials.filter(m => Number(m.quantity || 0) <= (Number(m.minThreshold) || 100)).length },
            { id: 'OUT', label: '🔴 Out of Stock', count: materials.filter(m => Number(m.quantity || 0) === 0).length },
            { id: 'OPTIMAL', label: '🟢 Optimal', count: materials.filter(m => Number(m.quantity || 0) > (Number(m.minThreshold) || 100)).length }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => { triggerHaptic('light'); setFilterStockStatus(st.id); }}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                filterStockStatus === st.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{st.label}</span>
              {st.count !== undefined && st.count > 0 && (
                <span className="ml-1 opacity-70">({st.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Category Pills with Dynamic Counts */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs border-t border-slate-100 pt-2">
          <button
            onClick={() => { triggerHaptic('light'); setFilterCategory('ALL'); }}
            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              filterCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Categories ({materials.length})
          </button>
          {categoryPresets.map(cat => {
            const count = materials.filter(m => m.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => { triggerHaptic('light'); setFilterCategory(cat.id); }}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition flex items-center space-x-1 cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setShowAddCategoryModal(true); }}
            className="px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition flex items-center space-x-1 cursor-pointer bg-blue-50 text-blue-700 border border-dashed border-blue-300 hover:bg-blue-100"
            title="Create New Custom Category"
          >
            <Plus size={13} className="stroke-[2.5]" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Select All Bar when in selection mode */}
      {isSelectMode && (
        <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-600">
          <button
            onClick={selectedIds.length === filteredMaterials.length ? handleDeselectAll : handleSelectAll}
            className="text-blue-600 flex items-center space-x-1 hover:underline cursor-pointer"
          >
            {selectedIds.length === filteredMaterials.length ? <CheckSquare size={15} /> : <Square size={15} />}
            <span>{selectedIds.length === filteredMaterials.length ? 'Deselect All' : `Select All (${filteredMaterials.length})`}</span>
          </button>
          <span>{selectedIds.length} of {filteredMaterials.length} selected</span>
        </div>
      )}

      {/* Inventory Item Display (Table vs Cards) */}
      {viewMode === 'TABLE' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-3 w-10 text-center">
                    {(isSelectMode || selectedIds.length > 0) && (
                      <button
                        onClick={selectedIds.length === filteredMaterials.length ? handleDeselectAll : handleSelectAll}
                        className="text-blue-600 cursor-pointer"
                        title={selectedIds.length === filteredMaterials.length ? 'Deselect All' : 'Select All'}
                      >
                        {selectedIds.length === filteredMaterials.length ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    )}
                  </th>
                  <th className="p-3 font-bold text-slate-700">Material & SKU</th>

                  {/* Category Column Header with Dropdown & Addable Option */}
                  <th className="p-3 relative font-bold text-slate-700">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          setIsCategoryHeaderDropdownOpen(!isCategoryHeaderDropdownOpen);
                        }}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 -ml-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          filterCategory !== 'ALL'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                        title="Category column — press for dropdown with categories & addable option"
                      >
                        <Tag size={12} className={filterCategory !== 'ALL' ? 'text-white' : 'text-blue-600'} />
                        <span>Category</span>
                        {filterCategory !== 'ALL' && (
                          <span className="text-[10px] font-black opacity-90">({filterCategory})</span>
                        )}
                        <ChevronDown size={12} className={`transition-transform duration-200 ${isCategoryHeaderDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isCategoryHeaderDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsCategoryHeaderDropdownOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 normal-case">
                            <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 mb-1">
                              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Category Filter</span>
                              <span className="text-[10px] font-bold text-slate-500">{materials.length} items</span>
                            </div>

                            <div className="max-h-56 overflow-y-auto px-1 space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setFilterCategory('ALL');
                                  setIsCategoryHeaderDropdownOpen(false);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                                  filterCategory === 'ALL'
                                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                                    : 'hover:bg-slate-100 text-slate-700 font-medium'
                                }`}
                              >
                                <span className="flex items-center space-x-1.5">
                                  <span>📁</span>
                                  <span>All Categories</span>
                                </span>
                                <span className={`text-[10px] font-bold ${filterCategory === 'ALL' ? 'text-white/80' : 'text-slate-400'}`}>
                                  ({materials.length})
                                </span>
                              </button>

                              {categoryPresets.map(cat => {
                                const count = materials.filter(m => m.category === cat.id).length;
                                const isSelected = filterCategory === cat.id;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setFilterCategory(cat.id);
                                      setIsCategoryHeaderDropdownOpen(false);
                                    }}
                                    className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                                        : 'hover:bg-slate-100 text-slate-700 font-medium'
                                    }`}
                                  >
                                    <span className="flex items-center space-x-2">
                                      <span>{cat.icon}</span>
                                      <span>{cat.label}</span>
                                    </span>
                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                      ({count})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setIsCategoryHeaderDropdownOpen(false);
                                  setShowAddCategoryModal(true);
                                }}
                                className="w-full px-2.5 py-2 rounded-xl text-left font-bold text-blue-600 bg-blue-50/70 hover:bg-blue-100 transition flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Plus size={14} className="stroke-[2.5]" />
                                <span>+ Add New Category</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </th>

                  <th className="p-3 font-bold text-slate-700">Stock Qty</th>
                  <th className="p-3 font-bold text-slate-700">Bay Location</th>
                  <th className="p-3 font-bold text-slate-700">Status</th>
                  <th className="p-3 pr-4 text-right font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMaterials.map((mat) => {
                  const qty = Number(mat.quantity) || 0;
                  const isLow = qty <= (Number(mat.minThreshold) || 100);
                  const isSelected = selectedIds.includes(mat.id);
                  const catObj = categoryPresets.find(c => c.id === mat.category);

                  return (
                    <tr
                      key={mat.id}
                      onClick={() => {
                        if (isSelectMode) toggleSelect(mat.id);
                      }}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-blue-50/40' : ''
                      } ${isSelectMode ? 'cursor-pointer' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        {(isSelectMode || selectedIds.length > 0) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(mat.id);
                            }}
                            className="p-0.5 rounded text-blue-600 cursor-pointer"
                          >
                            {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
                          </button>
                        )}
                      </td>

                      {/* Material Name & SKU */}
                      <td className="p-3">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isLow ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}>
                            <Boxes size={16} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900">{mat.name || 'Unnamed Material'}</span>
                              {mat.sku && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {mat.sku}
                                </span>
                              )}
                            </div>
                            {mat.receiptImage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(mat.receiptImage);
                                }}
                                className="flex items-center text-[10px] font-bold text-blue-600 hover:underline mt-0.5 cursor-pointer"
                              >
                                <Eye size={10} className="mr-0.5" /> Receipt Attached
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Column Cell with Dropdown and Addable Option */}
                      <td className="p-3 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setActiveCategoryRowId(activeCategoryRowId === mat.id ? null : mat.id);
                            }}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition cursor-pointer group shadow-2xs"
                            title="Click to change category or add new"
                          >
                            <span>{catObj?.icon || '🏷️'}</span>
                            <span>{mat.category || 'General'}</span>
                            <ChevronDown size={11} className="text-indigo-400 group-hover:text-indigo-700 transition" />
                          </button>

                          {activeCategoryRowId === mat.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveCategoryRowId(null)}
                              />
                              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 normal-case">
                                <div className="px-3 py-1 font-bold text-[10px] uppercase text-slate-400 tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                                  <span>Change Category</span>
                                  <span className="text-[10px] font-bold text-slate-500">Quick Assign</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto px-1 space-y-0.5">
                                  {categoryPresets.map(cat => {
                                    const isSelected = mat.category === cat.id;
                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                          handleUpdateItemCategory(mat.id, cat.id);
                                          setActiveCategoryRowId(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${
                                          isSelected
                                            ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                            : 'hover:bg-slate-100 text-slate-700 font-medium'
                                        }`}
                                      >
                                        <span className="flex items-center space-x-2">
                                          <span>{cat.icon}</span>
                                          <span>{cat.label}</span>
                                        </span>
                                        {isSelected && <Check size={13} className="text-white" />}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="border-t border-slate-100 mt-1 pt-1 px-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingCategoryMatId(mat.id);
                                      setActiveCategoryRowId(null);
                                      setShowAddCategoryModal(true);
                                    }}
                                    className="w-full px-2 py-1.5 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center space-x-1.5 cursor-pointer"
                                  >
                                    <Plus size={13} className="stroke-[2.5]" />
                                    <span>+ Add New Category</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Stock Qty & Quick Adjustment */}
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 text-sm">
                            {qty.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-slate-500 uppercase">{mat.unit || 'units'}</span>
                          <div className="flex items-center space-x-0.5 ml-2">
                            <button
                              onClick={() => handleAdjustQuantity(mat.id, -1)}
                              disabled={qty <= 0}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 disabled:opacity-30 cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => handleAdjustQuantity(mat.id, 1)}
                              className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 cursor-pointer"
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Storage Bay Location */}
                      <td className="p-3">
                        <span className="font-semibold text-slate-600 flex items-center">
                          <MapPin size={12} className="mr-1 text-slate-400" />
                          {mat.location || 'Bay A-1'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {qty === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            🔴 Out of Stock
                          </span>
                        ) : isLow ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              ⚠️ Low ({qty}/{mat.minThreshold})
                            </span>
                            <button
                              onClick={() => { setRestockItem(mat); setRestockAmount('500'); }}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 hover:bg-amber-300 transition flex items-center cursor-pointer"
                              title="Reorder Purchase Order"
                            >
                              <ShoppingCart size={9} className="mr-0.5" /> Reorder
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            🟢 Optimal
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenAddStock(mat)}
                            className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition cursor-pointer"
                            title="Add Stock (+)"
                          >
                            <PackagePlus size={15} />
                          </button>
                          <button
                            onClick={() => setSelectedLabel(mat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 transition cursor-pointer"
                            title="View Bin Asset Tag"
                          >
                            <QrCode size={15} />
                          </button>
                          <button
                            onClick={() => handleStartEdit(mat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition cursor-pointer"
                            title="Edit Material"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(mat.id, mat.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Inventory Item Cards View */
        <div className="space-y-3">
          {filteredMaterials.map((mat) => {
            const qty = Number(mat.quantity) || 0;
            const isLow = qty <= (Number(mat.minThreshold) || 100);
            const isSelected = selectedIds.includes(mat.id);
            const catObj = categoryPresets.find(c => c.id === mat.category);

            return (
              <div
                key={mat.id}
                onClick={() => {
                  if (isSelectMode) toggleSelect(mat.id);
                }}
                className={`bg-white p-4 rounded-2xl border transition relative overflow-hidden ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-md'
                    : 'border-slate-200/80 shadow-sm'
                } ${isSelectMode ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {/* Selection Checkbox */}
                    {(isSelectMode || selectedIds.length > 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(mat.id);
                        }}
                        className="mt-1 p-0.5 rounded text-blue-600 cursor-pointer"
                      >
                        {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-slate-300" />}
                      </button>
                    )}

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isLow ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                      <Boxes size={20} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{mat.name || 'Unnamed Material'}</h3>
                        {mat.sku && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {mat.sku}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {mat.location && (
                          <span className="text-[11px] font-semibold text-slate-500 flex items-center">
                            <MapPin size={11} className="mr-0.5 text-slate-400" /> {mat.location}
                          </span>
                        )}
                        
                        {/* Interactive Category Dropdown on Card */}
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setActiveCategoryRowId(activeCategoryRowId === mat.id ? null : mat.id);
                            }}
                            className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition cursor-pointer"
                            title="Click to change category or add new"
                          >
                            <span>{catObj?.icon || '🏷️'}</span>
                            <span>{mat.category || 'General'}</span>
                            <ChevronDown size={10} className="text-indigo-400" />
                          </button>

                          {activeCategoryRowId === mat.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveCategoryRowId(null)}
                              />
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-1 font-bold text-[10px] uppercase text-slate-400 tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                                  <span>Change Category</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto px-1 space-y-0.5">
                                  {categoryPresets.map(cat => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => {
                                        handleUpdateItemCategory(mat.id, cat.id);
                                        setActiveCategoryRowId(null);
                                      }}
                                      className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition cursor-pointer ${
                                        mat.category === cat.id
                                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                          : 'hover:bg-slate-100 text-slate-700 font-medium'
                                      }`}
                                    >
                                      <span className="flex items-center space-x-2">
                                        <span>{cat.icon}</span>
                                        <span>{cat.label}</span>
                                      </span>
                                      {mat.category === cat.id && <Check size={13} className="text-white" />}
                                    </button>
                                  ))}
                                </div>
                                <div className="border-t border-slate-100 mt-1 pt-1 px-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingCategoryMatId(mat.id);
                                      setActiveCategoryRowId(null);
                                      setShowAddCategoryModal(true);
                                    }}
                                    className="w-full px-2 py-1.5 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center space-x-1.5 cursor-pointer"
                                  >
                                    <Plus size={13} className="stroke-[2.5]" />
                                    <span>+ Add New Category</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {mat.receiptImage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(mat.receiptImage);
                            }}
                            className="flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          >
                            <Eye size={10} className="mr-1" /> Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenAddStock(mat)}
                      className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition cursor-pointer"
                      title="Add Stock (+)"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedLabel(mat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 transition cursor-pointer"
                      title="View Bin Asset Tag"
                    >
                      <QrCode size={16} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(mat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition cursor-pointer"
                      title="Edit Material"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(mat.id, mat.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Quantity, Low-Stock & PO Restock Action */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-xl font-black text-slate-900">
                        {qty.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase">{mat.unit || 'units'}</span>
                    </div>
                    {isLow ? (
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] font-bold text-amber-700 flex items-center">
                          <AlertTriangle size={10} className="mr-1" /> Low Stock ({qty}/{mat.minThreshold})
                        </span>
                        <button
                          onClick={() => { setRestockItem(mat); setRestockAmount('500'); }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 active:scale-95 transition flex items-center cursor-pointer"
                        >
                          <ShoppingCart size={10} className="mr-1" /> Reorder PO
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600">
                        Normal Reserve {mat.cost ? `(${mat.cost})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Quick Add / Deduct stock buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleAdjustQuantity(mat.id, -10)}
                      disabled={qty <= 0}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 text-xs font-bold transition disabled:opacity-30 cursor-pointer"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => handleAdjustQuantity(mat.id, -1)}
                      disabled={qty <= 0}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 text-xs font-bold transition disabled:opacity-30 cursor-pointer"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleAdjustQuantity(mat.id, 1)}
                      className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-90 text-blue-700 text-xs font-bold transition cursor-pointer"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => handleAdjustQuantity(mat.id, 10)}
                      className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-90 text-blue-700 text-xs font-bold transition cursor-pointer"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State when no materials found */}
      {filteredMaterials.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <Boxes size={36} className="mx-auto text-slate-300" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">No Raw Materials Found</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {filterCategory !== 'ALL' ? `No items in category "${filterCategory}".` : 'Register raw materials, units, minimum thresholds, and warehouse bin locations.'}
            </p>
          </div>
          {filterCategory !== 'ALL' ? (
            <button
              onClick={() => { triggerHaptic('light'); setFilterCategory('ALL'); }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
            >
              <span>Show All Categories</span>
            </button>
          ) : (
            <button
              onClick={() => { triggerHaptic('light'); setShowAddModal(true); }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Register First Raw Material</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Selection Toolbar for Bulk Operations */}
      <SelectionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredMaterials.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onCancel={() => {
          setSelectedIds([]);
          setIsSelectMode(false);
        }}
        actions={bulkActions}
      />

      {/* Bulk Add Stock Modal */}
      {showBulkStockModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PackagePlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Stock Addition</h3>
                  <p className="text-xs text-slate-500">Add stock across {selectedIds.length} selected materials</p>
                </div>
              </div>
              <button onClick={() => setShowBulkStockModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkAddStock} className="space-y-4 mt-4">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-900">
                ⚡ <strong>Bulk Action:</strong> Every selected item will have its in-stock quantity increased by the amount below.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Quantity to Add to Each Item *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bulkStockAddQty}
                  onChange={(e) => setBulkStockAddQty(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[25, 50, 100, 250, 500].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBulkStockAddQty(String(val))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xl shadow-emerald-500/30 active:scale-95 transition flex items-center justify-center space-x-2"
              >
                <PackagePlus size={16} />
                <span>Apply +{bulkStockAddQty} to {selectedIds.length} Materials</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Location Transfer Modal */}
      {showBulkLocationModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Bay Transfer</h3>
                  <p className="text-xs text-slate-500">Move {selectedIds.length} materials to new location</p>
                </div>
              </div>
              <button onClick={() => setShowBulkLocationModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkSetLocation} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Destination Warehouse Bay *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bay B-4, Rack 2"
                  value={bulkLocationValue}
                  onChange={(e) => setBulkLocationValue(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {commonBays.map(bay => (
                    <button
                      key={bay}
                      type="button"
                      onClick={() => setBulkLocationValue(bay)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        bulkLocationValue === bay ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {bay}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
              >
                Transfer {selectedIds.length} Items to {bulkLocationValue}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Category Modal */}
      {showBulkCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Category Assignment</h3>
                  <p className="text-xs text-slate-500">Assign category to {selectedIds.length} materials</p>
                </div>
              </div>
              <button onClick={() => setShowBulkCategoryModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBulkSetCategory} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2">
                {categoryPresets.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBulkCategoryValue(cat.id)}
                    className={`p-3 rounded-xl border text-left flex items-center space-x-2 transition cursor-pointer ${
                      bulkCategoryValue === cat.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-xs">{cat.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="p-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-left flex items-center space-x-2 transition cursor-pointer font-bold"
                >
                  <Plus size={16} />
                  <span className="text-xs">+ New Category</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition"
              >
                Set Category to "{bulkCategoryValue}" ({selectedIds.length} items)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Restock Purchase Order Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center">
                <ShoppingCart size={18} className="mr-2 text-amber-600" /> Generate Restock Requisition
              </h3>
              <button onClick={() => setRestockItem(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleRestockPO} className="space-y-4 mt-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs font-bold text-amber-900">{restockItem.name}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Current: {restockItem.quantity} {restockItem.unit} (Alert threshold: {restockItem.minThreshold})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Requisition Amount ({restockItem.unit}) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  required
                  min="1"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-amber-600 text-white font-bold text-sm shadow-xl shadow-amber-500/30 active:scale-95 transition"
                >
                  Approve & Receive Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock to Already Created Item Modal */}
      {stockItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PackagePlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Stock to Item</h3>
                  <p className="text-[11px] text-slate-500">Receive shipment or top-up inventory</p>
                </div>
              </div>
              <button 
                onClick={() => setStockItem(null)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddStock} className="space-y-4 mt-4">
              {/* Item Selection Dropdown if multiple items exist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Material / Item *
                </label>
                <select
                  value={stockItem.id}
                  onChange={(e) => {
                    const sel = materials.find(m => String(m.id) === String(e.target.value));
                    if (sel) handleOpenAddStock(sel);
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.sku ? `(${m.sku})` : ''} — On Hand: {m.quantity} {m.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Stock Calculation Card */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Current In-Stock</span>
                    <p className="text-lg font-black text-emerald-950 mt-0.5">
                      {Number(stockItem.quantity || 0).toLocaleString()} <span className="text-xs font-bold">{stockItem.unit}</span>
                    </p>
                  </div>
                  <div className="text-center px-2 text-emerald-600 font-bold text-sm">
                    ➔
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">New Total Stock</span>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">
                      {(Number(stockItem.quantity || 0) + (Number(stockAddQty) || 0)).toLocaleString()} <span className="text-xs font-bold">{stockItem.unit}</span>
                    </p>
                  </div>
                </div>
                {stockItem.location && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-2 pt-2 border-t border-emerald-200/60 flex items-center">
                    <MapPin size={11} className="mr-1 opacity-70" /> Bin Location: {stockItem.location}
                  </p>
                )}
              </div>

              {/* Quantity to Add input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Quantity to Add ({stockItem.unit}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 100"
                    value={stockAddQty}
                    onChange={(e) => setStockAddQty(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-slate-400">
                    {stockItem.unit}
                  </span>
                </div>

                {/* Quick Preset Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[10, 25, 50, 100, 250, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStockAddQty(String(val))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        stockAddQty === String(val)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Receiving Metadata */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">PO / Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-90"
                    value={stockPO}
                    onChange={(e) => setStockPO(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Metals"
                    value={stockSupplier}
                    onChange={(e) => setStockSupplier(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4.50"
                    value={stockUnitCost}
                    onChange={(e) => setStockUnitCost(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Storage Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bay 4, Rack B"
                    value={stockLocation}
                    onChange={(e) => setStockLocation(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Delivery Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Batch verified, no shipment damage"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockItem(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xl shadow-emerald-500/30 active:scale-95 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <PackagePlus size={16} />
                  <span>Confirm +{Number(stockAddQty || 0).toLocaleString()} {stockItem.unit}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset QR / Barcode Tag Modal */}
      {selectedLabel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bin Identification Tag</span>
              <button onClick={() => setSelectedLabel(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="w-36 h-36 mx-auto bg-slate-900 rounded-2xl p-3 flex flex-col items-center justify-center text-white space-y-2 shadow-inner">
              <QrCode size={80} className="text-white" />
              <span className="text-[10px] font-mono tracking-widest text-slate-400">{selectedLabel.sku || 'SKU-001'}</span>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900">{selectedLabel.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Location: <strong className="text-slate-800">{selectedLabel.location || 'Warehouse'}</strong></p>
              <p className="text-xs font-bold text-blue-600 mt-1">{selectedLabel.quantity} {selectedLabel.unit} in stock</p>
            </div>

            <button
              onClick={() => { triggerHaptic('light'); showToast('Asset tag ready for printer or mobile scanner'); setSelectedLabel(null); }}
              className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
            >
              Close Asset Tag
            </button>
          </div>
        </div>
      )}

      {/* Slide-over / Modal for Adding New Material */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Material Inventory</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Material Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cold Rolled Steel Coil"
                  value={newMat.name}
                  onChange={(e) => setNewMat({ ...newMat, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Advanced Category Visual Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {categoryPresets.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setNewMat({ ...newMat, category: cat.id }); }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                        newMat.category === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-[11px] font-bold">{cat.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="p-2.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-1 font-bold"
                  >
                    <Plus size={18} />
                    <span className="text-[11px]">+ New Category</span>
                  </button>
                </div>
              </div>

              {/* SKU & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SKU Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. STL-CR-40"
                    value={newMat.sku}
                    onChange={(e) => setNewMat({ ...newMat, sku: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Quantity *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={newMat.quantity}
                    onChange={(e) => setNewMat({ ...newMat, quantity: e.target.value })}
                    required
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600"
                  />
                </div>
              </div>

              {/* Advanced Unit Measure Visual Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Unit Measure: <strong className="text-blue-600 uppercase font-black">{newMat.unit}</strong>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>+ Add Unit</span>
                  </button>
                </div>
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {unitPresets.map((group, gIdx) => (
                    <div key={gIdx} className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">{group.group}:</span>
                      <div className="flex flex-wrap gap-1">
                        {group.units.map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => { triggerHaptic('light'); setNewMat({ ...newMat, unit: u }); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              newMat.unit === u
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location & Alert Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Warehouse Bay Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bay A-12"
                    value={newMat.location}
                    onChange={(e) => setNewMat({ ...newMat, location: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                  {/* Preset Bay Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {commonBays.slice(0, 3).map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setNewMat({ ...newMat, location: b })}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={newMat.minThreshold}
                    onChange={(e) => setNewMat({ ...newMat, minThreshold: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[50, 100, 250].map(th => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => setNewMat({ ...newMat, minThreshold: String(th) })}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scanned Receipt Preview */}
              {newMat.receiptImage ? (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={newMat.receiptImage} alt="Receipt" className="w-10 h-10 object-cover rounded-lg border border-indigo-200" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">Receipt Attached</p>
                      <p className="text-[10px] text-indigo-600">Saved with record</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewMat(p => ({ ...p, receiptImage: null }))}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleScanReceipt}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <CameraIcon size={16} />
                  <span>Attach Photo / Receipt</span>
                </button>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl overflow-hidden p-4 relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80"
            >
              ✕
            </button>
            <img src={previewImage} alt="Receipt preview" className="w-full max-h-[70vh] object-contain rounded-xl" />
            <p className="text-center text-xs text-slate-300 mt-3 font-semibold">Procurement Receipt Verification</p>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Raw Material</h3>
                  <p className="text-[11px] text-slate-500">{editingMat.sku || editingMat.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingMat(null)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Material Name *</label>
                <input
                  type="text"
                  value={editingMat.name}
                  onChange={(e) => setEditingMat({ ...editingMat, name: e.target.value })}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Advanced Category Visual Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {categoryPresets.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setEditingMat({ ...editingMat, category: cat.id }); }}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                        editingMat.category === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-[10px] font-bold">{cat.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="p-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-1 font-bold"
                  >
                    <Plus size={16} />
                    <span className="text-[10px]">+ New Category</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={editingMat.sku}
                    onChange={(e) => setEditingMat({ ...editingMat, sku: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Stock ({editingMat.unit})</label>
                  <input
                    type="number"
                    value={editingMat.quantity}
                    onChange={(e) => setEditingMat({ ...editingMat, quantity: e.target.value })}
                    required
                    min="0"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600"
                  />
                </div>
              </div>

              {/* Advanced Unit Measure Visual Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Unit Measure: <strong className="text-blue-600 uppercase font-black">{editingMat.unit || 'units'}</strong>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>+ Add Unit</span>
                  </button>
                </div>
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {unitPresets.map((group, gIdx) => (
                    <div key={gIdx} className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">{group.group}:</span>
                      <div className="flex flex-wrap gap-1">
                        {group.units.map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => { triggerHaptic('light'); setEditingMat({ ...editingMat, unit: u }); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              editingMat.unit === u
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location / Bay</label>
                  <input
                    type="text"
                    value={editingMat.location}
                    onChange={(e) => setEditingMat({ ...editingMat, location: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    value={editingMat.minThreshold}
                    onChange={(e) => setEditingMat({ ...editingMat, minThreshold: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMat(null)}
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

      {/* Dynamic Create Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/80">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Material Category</h3>
                  <p className="text-[11px] text-slate-500">Create custom category classification</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddCategoryModal(false)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Fasteners, Raw Timber, Fabrics, IC Chips"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Icon / Emoji Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Category Icon: <span className="text-lg ml-1">{newCatIcon}</span>
                </label>
                <div className="grid grid-cols-6 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {['🔩', '⚙️', '🧪', '📦', '⚡', '📁', '🪵', '🧵', '🧱', '🛢️', '💡', '🛡️', '🎨', '🔋', '🏷️', '🔬', '📐', '🧰'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCatIcon(icon)}
                      className={`h-9 flex items-center justify-center rounded-lg text-lg transition cursor-pointer ${
                        newCatIcon === icon 
                          ? 'bg-blue-600 shadow-xs ring-2 ring-blue-500/40 text-white' 
                          : 'hover:bg-white'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>Create & Select Category</span>
              </button>

              {/* Existing Categories List with Deletion */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Existing Categories ({categoryPresets.length})
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl">
                  {categoryPresets.map(cat => {
                    const isDefault = DEFAULT_CATEGORIES.some(dc => dc.id.toLowerCase() === cat.id.toLowerCase());
                    return (
                      <span
                        key={cat.id}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs"
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="ml-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title={`Delete ${cat.label}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Create Unit Modal */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/80">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 sm:pb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Unit of Measure</h3>
                  <p className="text-[11px] text-slate-500">Register new custom measurement unit</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddUnitModal(false)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Unit Name / Symbol *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. sq ft, pallet, drum, bundle, vial, pcs"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Preset Unit Suggestions */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Quick Unit Suggestions
                </label>
                <div className="flex flex-wrap gap-1">
                  {['sq ft', 'sq m', 'bundle', 'pallet', 'drum', 'pack', 'vial', 'sheet', 'pair', 'lbs', 'oz', 'ml'].map(sugg => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => setNewUnitName(sugg)}
                      className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 cursor-pointer"
                    >
                      +{sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group / Classification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Measurement Classification
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Mass', 'Count', 'Volume', 'Length', 'Area', 'Packaging', 'Custom'].map(grp => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setNewUnitGroup(grp)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        newUnitGroup === grp
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>Create & Select Unit</span>
              </button>

              {/* Existing Units Overview */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Configured Units
                </p>
                <div className="space-y-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl">
                  {unitPresets.map((group, idx) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-xs">
                      <span className="font-bold text-slate-400 text-[10px] uppercase w-16 shrink-0">{group.group}:</span>
                      <div className="flex flex-wrap gap-1">
                        {group.units.map(u => {
                          const isDefaultUnit = DEFAULT_UNITS.some(dg => (dg.units || []).includes(u));
                          return (
                            <span
                              key={u}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 text-[11px] font-semibold"
                            >
                              <span>{u}</span>
                              {!isDefaultUnit && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUnit(u)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5"
                                  title={`Delete unit ${u}`}
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
