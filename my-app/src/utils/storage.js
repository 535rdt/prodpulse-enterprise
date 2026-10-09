import localforage from 'localforage';
import { 
  syncToCloud, 
  fetchFromCloud, 
  listenToCloudKey, 
  subscribeCloudStatus,
  subscribeAuthState,
  getCurrentUser,
  firebaseConfig 
} from './firebase';

export { subscribeCloudStatus, firebaseConfig };

localforage.config({
  name: 'ProductionPro',
  storeName: 'production_enterprise_store'
});

const SYNC_KEYS = [
  'materials',
  'customCategories',
  'customUnits',
  'recipes',
  'workOrders',
  'productionHistory',
  'productionRate',
  'machines',
  'downtimeLogs',
  'qualityInspections',
  'staff',
  'shiftHandovers',
  'userProfile',
  'appSettings'
];

let syncInitialized = false;
let activeUnsubscribes = [];

/**
 * Returns a partitioned local storage key for the active user.
 * Example: 'user_12345_materials' or 'guest_materials'.
 */
export function getUserStorageKey(baseKey) {
  const user = getCurrentUser();
  if (user && user.uid) {
    return `user_${user.uid}_${baseKey}`;
  }
  return `guest_${baseKey}`;
}

/**
 * Read from per-user local storage with graceful fallback to legacy baseKey.
 * This guarantees no existing data is ever lost during account transitions.
 */
async function getStoredItem(baseKey, defaultValue = null) {
  try {
    const userKey = getUserStorageKey(baseKey);
    let data = await localforage.getItem(userKey);

    // Fallback to legacy un-prefixed key if userKey not initialized
    if (data === null || data === undefined) {
      const legacyData = await localforage.getItem(baseKey);
      if (legacyData !== null && legacyData !== undefined) {
        data = legacyData;
        // Migrate to user key for persistent isolated storage
        await localforage.setItem(userKey, legacyData);
      }
    }

    return (data !== null && data !== undefined) ? data : defaultValue;
  } catch (err) {
    console.error(`[Storage Read Error] ${baseKey}:`, err);
    return defaultValue;
  }
}

/**
 * Write to per-user local storage and trigger cloud sync.
 */
async function setStoredItem(baseKey, data) {
  try {
    const userKey = getUserStorageKey(baseKey);
    await localforage.setItem(userKey, data);

    const user = getCurrentUser();
    // In guest mode, also update legacy baseKey for seamless backward compatibility
    if (!user || !user.uid) {
      await localforage.setItem(baseKey, data);
    }

    // Attempt cloud push if signed in
    syncToCloud(baseKey, data).catch(() => {});
    return data;
  } catch (err) {
    console.error(`[Storage Write Error] ${baseKey}:`, err);
    return data;
  }
}

/**
 * Rebinds cloud sync to the authenticated user's private workspace.
 * When User A logs in, they only sync with their own private cloud data.
 * When User B logs in, they only sync with their own separate cloud data.
 */
export function rebindUserSync(currentUser) {
  // Tear down any previous subscriptions
  activeUnsubscribes.forEach(unsub => {
    try { unsub(); } catch (e) {}
  });
  activeUnsubscribes = [];

  // Notify UI immediately that the active workspace switched (login or logout)
  window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { user: currentUser } }));

  if (!currentUser || !currentUser.uid) {
    // Guest or logged-out mode: stays strictly local
    return;
  }

  const userKeyPrefix = `user_${currentUser.uid}_`;

  // Bind real-time listeners for the authenticated user's private collection
  SYNC_KEYS.forEach(key => {
    const unsub = listenToCloudKey(key, async (remoteData) => {
      if (remoteData !== undefined && remoteData !== null) {
        await localforage.setItem(userKeyPrefix + key, remoteData);
        window.dispatchEvent(new CustomEvent('prodpulse-cloud-sync', { detail: { key, data: remoteData } }));
        window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { key, data: remoteData } }));
      }
    });
    if (typeof unsub === 'function') activeUnsubscribes.push(unsub);
  });

  // Reconcile user's private cloud workspace with local cache
  setTimeout(async () => {
    for (const key of SYNC_KEYS) {
      try {
        const remoteData = await fetchFromCloud(key);
        const localKey = userKeyPrefix + key;
        const localData = await localforage.getItem(localKey);

        if (remoteData === null || remoteData === undefined) {
          // No cloud data yet: if local has data, upload to user's cloud account!
          if (localData !== null && localData !== undefined) {
            await syncToCloud(key, localData);
          } else {
            // Check legacy key to migrate initial data into new account
            const legacyData = await localforage.getItem(key);
            if (legacyData !== null && legacyData !== undefined) {
              await localforage.setItem(localKey, legacyData);
              await syncToCloud(key, legacyData);
              window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { key, data: legacyData } }));
            }
          }
        } else {
          // Cloud has authoritative data: update local cache
          await localforage.setItem(localKey, remoteData);
          window.dispatchEvent(new CustomEvent('prodpulse-cloud-sync', { detail: { key, data: remoteData } }));
          window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { key, data: remoteData } }));
        }
      } catch (err) {
        console.debug(`[User Sync] Reconciliation error for ${key}:`, err);
      }
    }
  }, 400);
}

/**
 * Initializes two-way real-time Firestore sync with per-user isolation.
 */
export function initCloudSync() {
  if (syncInitialized) return;
  syncInitialized = true;

  // Automatically listen to auth changes and dynamically switch workspaces
  subscribeAuthState((user) => {
    rebindUserSync(user);
  });
}

// Materials API (Raw Materials Inventory)
export async function getMaterials() {
  const data = await getStoredItem('materials', []);
  return Array.isArray(data) ? data : [];
}

export async function setMaterials(materials) {
  const safeData = materials || [];
  return await setStoredItem('materials', safeData);
}

// Custom Categories API
export const DEFAULT_CATEGORIES = [
  { id: 'Metals', label: 'Metals', icon: '🔩', color: 'blue' },
  { id: 'Hardware', label: 'Hardware', icon: '⚙️', color: 'indigo' },
  { id: 'Chemicals', label: 'Chemicals', icon: '🧪', color: 'purple' },
  { id: 'Packaging', label: 'Packaging', icon: '📦', color: 'amber' },
  { id: 'Electrical', label: 'Electrical', icon: '⚡', color: 'yellow' },
  { id: 'General', label: 'General', icon: '📁', color: 'slate' }
];

export async function getCategories() {
  const data = await getStoredItem('customCategories', DEFAULT_CATEGORIES);
  if (data && Array.isArray(data) && data.length > 0) {
    return data;
  }
  return DEFAULT_CATEGORIES;
}

export async function setCategories(categories) {
  const safeData = categories || DEFAULT_CATEGORIES;
  return await setStoredItem('customCategories', safeData);
}

export async function addCategory(newCat) {
  const cats = await getCategories();
  const label = typeof newCat === 'string' ? newCat.trim() : (newCat.label || newCat.id || '').trim();
  if (!label) return cats;

  const id = label;
  const existing = cats.find(c => c.id.toLowerCase() === id.toLowerCase() || c.label.toLowerCase() === label.toLowerCase());
  if (existing) return cats;

  const icon = typeof newCat === 'object' && newCat.icon ? newCat.icon : '🏷️';
  const color = typeof newCat === 'object' && newCat.color ? newCat.color : 'blue';
  const updated = [...cats, { id, label, icon, color }];
  await setCategories(updated);
  return updated;
}

export async function deleteCategory(catId) {
  const cats = await getCategories();
  const updated = cats.filter(c => c.id.toLowerCase() !== catId.toLowerCase());
  await setCategories(updated);
  return updated;
}

// Custom Units API
export const DEFAULT_UNITS = [
  { group: 'Mass', units: ['kg', 'tons', 'g', 'lbs'] },
  { group: 'Count', units: ['units', 'boxes', 'rolls', 'pieces', 'packs'] },
  { group: 'Volume', units: ['liters', 'gallons', 'ml'] },
  { group: 'Length', units: ['meters', 'feet', 'inches'] },
  { group: 'Custom', units: [] }
];

export async function getUnits() {
  const data = await getStoredItem('customUnits', DEFAULT_UNITS);
  if (data && Array.isArray(data) && data.length > 0) {
    return data;
  }
  return DEFAULT_UNITS;
}

export async function setUnits(units) {
  const safeData = units || DEFAULT_UNITS;
  return await setStoredItem('customUnits', safeData);
}

export async function addUnit(newUnit, groupName = 'Custom') {
  const trimmed = (newUnit || '').trim().toLowerCase();
  if (!trimmed) return await getUnits();

  const groups = await getUnits();
  const allUnits = groups.flatMap(g => g.units || []);
  if (allUnits.some(u => u.toLowerCase() === trimmed)) {
    return groups;
  }

  let foundGroup = false;
  const updated = groups.map(g => {
    if (g.group.toLowerCase() === groupName.toLowerCase()) {
      foundGroup = true;
      return { ...g, units: [...(g.units || []), trimmed] };
    }
    return g;
  });

  if (!foundGroup) {
    updated.push({ group: groupName, units: [trimmed] });
  }

  await setUnits(updated);
  return updated;
}

export async function deleteUnit(unitName) {
  const trimmed = (unitName || '').trim().toLowerCase();
  const groups = await getUnits();
  const updated = groups.map(g => ({
    ...g,
    units: (g.units || []).filter(u => u.toLowerCase() !== trimmed)
  }));
  await setUnits(updated);
  return updated;
}

// Recipes API (Formulas / Bill of Materials for Finished Products)
export async function getRecipes() {
  const data = await getStoredItem('recipes', []);
  return Array.isArray(data) ? data : [];
}

export async function setRecipes(recipes) {
  const safeData = recipes || [];
  return await setStoredItem('recipes', safeData);
}

// Automatically deduct raw materials inventory based on a product recipe and units produced
export async function deductRecipeMaterials(recipeId, unitsProduced) {
  const recipes = await getRecipes();
  const materials = await getMaterials();
  const recipe = recipes.find(r => r && (r.id === recipeId || r.name === recipeId));

  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return { 
      success: false, 
      message: 'No recipe formula or ingredients linked', 
      deductedSummary: [], 
      shortages: [] 
    };
  }

  const numUnits = Number(unitsProduced) || 0;
  if (numUnits <= 0) {
    return { 
      success: false, 
      message: 'Produced quantity must be greater than zero', 
      deductedSummary: [], 
      shortages: [] 
    };
  }

  let updatedMaterials = [...materials];
  let deductedSummary = [];
  let shortages = [];

  for (const item of recipe.ingredients) {
    const requiredPerUnit = Number(item.qtyPerUnit) || 0;
    const totalToDeduct = requiredPerUnit * numUnits;

    const targetMat = updatedMaterials.find(m => 
      m.id === item.materialId || 
      (m.name && (item.materialName || item.name) && m.name.toLowerCase() === (item.materialName || item.name).toLowerCase())
    );

    if (targetMat) {
      const currentQty = Number(targetMat.quantity) || 0;
      if (currentQty < totalToDeduct) {
        shortages.push({
          materialId: targetMat.id,
          name: targetMat.name,
          required: totalToDeduct,
          available: currentQty,
          unit: targetMat.unit || 'units'
        });
      }

      const remaining = Math.max(0, currentQty - totalToDeduct);
      deductedSummary.push({
        materialId: targetMat.id,
        name: targetMat.name,
        qtyPerUnit: requiredPerUnit,
        deducted: totalToDeduct,
        remaining,
        unit: targetMat.unit || 'units'
      });

      updatedMaterials = updatedMaterials.map(m => 
        m.id === targetMat.id ? { ...m, quantity: remaining } : m
      );
    } else {
      shortages.push({
        materialId: item.materialId,
        name: item.materialName || item.name || 'Unknown Material',
        required: totalToDeduct,
        available: 0,
        unit: item.unit || 'units'
      });
    }
  }

  await setMaterials(updatedMaterials);
  return {
    success: true,
    recipeName: recipe.name,
    product: recipe.product || recipe.name,
    deductedSummary,
    shortages,
    textSummary: deductedSummary.map(d => `${d.name}: -${d.deducted} ${d.unit} (remaining: ${d.remaining})`)
  };
}

// Work Orders API
export async function getWorkOrders() {
  const data = await getStoredItem('workOrders', []);
  return Array.isArray(data) ? data : [];
}

export async function setWorkOrders(orders) {
  const safeData = orders || [];
  return await setStoredItem('workOrders', safeData);
}

// Deduct Bill of Materials inventory when Work Order units are produced
export async function deductBOM(workOrderId, unitsProduced) {
  const orders = await getWorkOrders();
  const order = orders.find(o => o.id === workOrderId);

  if (!order) return { success: false, message: 'Work Order not found', summary: [] };

  if (order.recipeId) {
    const res = await deductRecipeMaterials(order.recipeId, unitsProduced);
    return {
      success: res.success,
      summary: res.textSummary || [],
      details: res.deductedSummary,
      shortages: res.shortages
    };
  }

  if (!order.bom || order.bom.length === 0) return { success: false, message: 'No BOM linked to order', summary: [] };

  const materials = await getMaterials();
  let updatedMaterials = [...materials];
  let deductedSummary = [];

  for (const item of order.bom) {
    const totalToDeduct = (Number(item.qtyPerUnit) || 0) * Number(unitsProduced);
    updatedMaterials = updatedMaterials.map(m => {
      if (m.id === item.materialId || m.name === item.name) {
        const remaining = Math.max(0, (Number(m.quantity) || 0) - totalToDeduct);
        deductedSummary.push(`${m.name}: -${totalToDeduct} ${m.unit}`);
        return { ...m, quantity: remaining };
      }
      return m;
    });
  }

  await setMaterials(updatedMaterials);
  return { success: true, summary: deductedSummary, textSummary: deductedSummary };
}

// Production API
export async function getProduction() {
  let rate = await getStoredItem('productionRate', 0);
  let history = await getStoredItem('productionHistory', []);

  return { 
    rate: rate !== null && rate !== undefined ? Number(rate) : 0, 
    history: Array.isArray(history) ? history : [] 
  };
}

export async function setProduction(rate, history) {
  if (rate !== undefined) {
    const r = Number(rate) || 0;
    await setStoredItem('productionRate', r);
  }
  if (history !== undefined) {
    const h = history || [];
    await setStoredItem('productionHistory', h);
  }
}

// Machines & Downtime API
export async function getMachines() {
  const data = await getStoredItem('machines', []);
  return Array.isArray(data) ? data : [];
}

export async function setMachines(machines) {
  const safeData = machines || [];
  return await setStoredItem('machines', safeData);
}

export async function getDowntimeLogs() {
  const data = await getStoredItem('downtimeLogs', []);
  return Array.isArray(data) ? data : [];
}

export async function setDowntimeLogs(logs) {
  const safeData = logs || [];
  return await setStoredItem('downtimeLogs', safeData);
}

// Quality Assurance API
export async function getQualityInspections() {
  const data = await getStoredItem('qualityInspections', []);
  return Array.isArray(data) ? data : [];
}

export async function setQualityInspections(inspections) {
  const safeData = inspections || [];
  return await setStoredItem('qualityInspections', safeData);
}

// Staff & Roster API
export async function getStaff() {
  const data = await getStoredItem('staff', []);
  return Array.isArray(data) ? data : [];
}

export async function setStaff(staff) {
  const safeData = staff || [];
  return await setStoredItem('staff', safeData);
}

// Shift Handover API
export async function getHandovers() {
  const data = await getStoredItem('shiftHandovers', []);
  return Array.isArray(data) ? data : [];
}

export async function setHandovers(handovers) {
  const safeData = handovers || [];
  return await setStoredItem('shiftHandovers', safeData);
}

// User Profile API
export async function getUserProfile() {
  const defaultProfile = {
    name: 'Plant Operator',
    role: 'Operations Supervisor',
    department: 'Main Assembly & Floor',
    badgeId: 'OP-501',
    email: '',
    phone: '',
    shift: 'Morning',
    avatarColor: 'blue'
  };
  const data = await getStoredItem('userProfile', defaultProfile);
  if (!data || typeof data !== 'object') {
    return defaultProfile;
  }
  return data;
}

export async function setUserProfile(profile) {
  const safeData = profile || {};
  return await setStoredItem('userProfile', safeData);
}

// App Settings & Preferences API
export async function getAppSettings() {
  const defaultSettings = {
    plantName: 'ProdPulse Facility 1',
    plantLocation: 'Main Plant, Sector 4',
    autoDeductBOM: true,
    defaultDailyTarget: 500,
    enableHaptics: true,
    compactView: false,
    theme: 'dark'
  };
  const data = await getStoredItem('appSettings', defaultSettings);
  if (!data || typeof data !== 'object') {
    return defaultSettings;
  }
  return data;
}

export async function setAppSettings(settings) {
  const safeData = settings || {};
  return await setStoredItem('appSettings', safeData);
}

// Export Full Database (For Local Backup & Air-Gapped Archival)
export async function exportFullDatabase() {
  const mats = await getMaterials();
  const recs = await getRecipes();
  const orders = await getWorkOrders();
  const prod = await getProduction();
  const machines = await getMachines();
  const downtime = await getDowntimeLogs();
  const qa = await getQualityInspections();
  const staff = await getStaff();
  const handovers = await getHandovers();
  const profile = await getUserProfile();
  const settings = await getAppSettings();
  const categories = await getCategories();
  const units = await getUnits();

  return {
    version: '2.2.0',
    exportTimestamp: new Date().toISOString(),
    materials: mats,
    recipes: recs,
    workOrders: orders,
    productionRate: prod.rate,
    productionHistory: prod.history,
    machines,
    downtimeLogs: downtime,
    qualityInspections: qa,
    staff,
    shiftHandovers: handovers,
    userProfile: profile,
    appSettings: settings,
    customCategories: categories,
    customUnits: units
  };
}

export async function importDatabase(backupData) {
  if (!backupData || typeof backupData !== 'object') throw new Error('Invalid backup file format');

  if (Array.isArray(backupData.materials)) await setMaterials(backupData.materials);
  if (Array.isArray(backupData.recipes)) await setRecipes(backupData.recipes);
  if (Array.isArray(backupData.workOrders)) await setWorkOrders(backupData.workOrders);
  if (backupData.productionRate !== undefined || Array.isArray(backupData.productionHistory)) {
    await setProduction(backupData.productionRate, backupData.productionHistory);
  }
  if (Array.isArray(backupData.machines)) await setMachines(backupData.machines);
  if (Array.isArray(backupData.downtimeLogs)) await setDowntimeLogs(backupData.downtimeLogs);
  if (Array.isArray(backupData.qualityInspections)) await setQualityInspections(backupData.qualityInspections);
  if (Array.isArray(backupData.staff)) await setStaff(backupData.staff);
  if (Array.isArray(backupData.shiftHandovers)) await setHandovers(backupData.shiftHandovers);
  if (backupData.userProfile) await setUserProfile(backupData.userProfile);
  if (backupData.appSettings) await setAppSettings(backupData.appSettings);
  if (Array.isArray(backupData.customCategories)) await setCategories(backupData.customCategories);
  if (Array.isArray(backupData.customUnits)) await setUnits(backupData.customUnits);

  window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { imported: true } }));
  return true;
}

// Clear all data completely (clean production slate for active workspace)
export async function clearAllData() {
  await setMaterials([]);
  await setRecipes([]);
  await setWorkOrders([]);
  await setProduction(0, []);
  await setMachines([]);
  await setDowntimeLogs([]);
  await setQualityInspections([]);
  await setStaff([]);
  await setHandovers([]);
  await setUserProfile(null);
  await setAppSettings(null);
  await setCategories(DEFAULT_CATEGORIES);
  await setUnits(DEFAULT_UNITS);
  window.dispatchEvent(new CustomEvent('prodpulse-data-changed', { detail: { cleared: true } }));
}
