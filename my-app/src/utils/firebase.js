import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

export const firebaseConfig = {
  apiKey: "AIzaSyA6Y_rf8EjlCBeRVuCwKaL3_LC3FaDwqPE",
  authDomain: "prodpulse-cloud.firebaseapp.com",
  projectId: "prodpulse-cloud",
  storageBucket: "prodpulse-cloud.firebasestorage.app",
  messagingSenderId: "1023100975920",
  appId: "1:1023100975920:web:378bde78fd0cca32a526f5",
  measurementId: "G-PFQYGZX0XV"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Authentication
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with robust multi-tab persistent cache
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

// Cloud Sync Status Tracking: 'CONNECTED' | 'ERROR' | 'OFFLINE' | 'UNINITIALIZED' | 'GUEST'
let cloudStatus = 'GUEST';
let lastSyncTimestamp = null;
const statusListeners = new Set();

export function subscribeCloudStatus(callback) {
  statusListeners.add(callback);
  callback({ 
    status: cloudStatus, 
    isOnline: cloudStatus === 'CONNECTED', 
    lastSync: lastSyncTimestamp,
    projectId: firebaseConfig.projectId,
    userId: auth.currentUser?.uid || null,
    userEmail: auth.currentUser?.email || null
  });
  return () => statusListeners.delete(callback);
}

export function setCloudStatus(newStatus) {
  if (cloudStatus !== newStatus) {
    cloudStatus = newStatus;
    if (newStatus === 'CONNECTED') {
      lastSyncTimestamp = new Date();
    }
    const stateObj = {
      status: cloudStatus,
      isOnline: cloudStatus === 'CONNECTED',
      lastSync: lastSyncTimestamp,
      projectId: firebaseConfig.projectId,
      userId: auth.currentUser?.uid || null,
      userEmail: auth.currentUser?.email || null
    };
    statusListeners.forEach(cb => {
      try { cb(stateObj); } catch (e) { console.error(e); }
    });
  }
}

export function getCloudStatus() {
  return {
    status: cloudStatus,
    isOnline: cloudStatus === 'CONNECTED',
    lastSync: lastSyncTimestamp,
    projectId: firebaseConfig.projectId,
    userId: auth.currentUser?.uid || null,
    userEmail: auth.currentUser?.email || null
  };
}

/**
 * Returns a private, isolated document reference for the current authenticated user.
 * This guarantees User A and User B never see or touch each other's data!
 */
function getPrivateUserDocRef(key) {
  if (!db) return null;
  const user = auth.currentUser;
  // If not signed in (Guest/Local mode), do not write to shared cloud.
  if (!user || !user.uid) return null;
  // Each user gets their own completely isolated workspace path:
  // /user_workspaces/{user.uid}/enterprise_data/{key}
  return doc(db, 'user_workspaces', user.uid, 'enterprise_data', key);
}

/**
 * Save data payload to the authenticated user's private cloud workspace
 */
export async function pushToCloud(key, data) {
  const docRef = getPrivateUserDocRef(key);
  if (!docRef) {
    // Guest/Offline mode: changes stay strictly on the local device!
    return false;
  }
  try {
    const cleanData = JSON.parse(JSON.stringify(data === undefined ? null : data));
    await setDoc(docRef, {
      payload: cleanData,
      lastUpdated: new Date().toISOString(),
      ownerUid: auth.currentUser.uid,
      ownerEmail: auth.currentUser.email || 'operator'
    }, { merge: true });
    setCloudStatus('CONNECTED');
    return true;
  } catch (err) {
    console.debug(`[Private Cloud Sync] Error pushing ${key}:`, err.message);
    const msg = (err.message || '').toLowerCase();
    const code = (err.code || '').toLowerCase();
    if (msg.includes('not_found') || msg.includes('not found') || code.includes('not-found') || msg.includes('does not exist')) {
      setCloudStatus('DATABASE_NOT_CREATED');
    } else if (msg.includes('permission-denied') || msg.includes('permission denied') || code.includes('permission-denied')) {
      setCloudStatus('PERMISSION_DENIED');
    } else {
      setCloudStatus('OFFLINE');
    }
    return false;
  }
}

/**
 * Fetch document from the authenticated user's private cloud workspace
 */
export async function fetchFromCloud(key) {
  const docRef = getPrivateUserDocRef(key);
  if (!docRef) return null;

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      setCloudStatus('CONNECTED');
      return snap.data()?.payload;
    }
    return null;
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    const code = (err.code || '').toLowerCase();
    if (msg.includes('not_found') || msg.includes('not found') || code.includes('not-found') || msg.includes('does not exist')) {
      setCloudStatus('DATABASE_NOT_CREATED');
    } else if (msg.includes('permission-denied') || msg.includes('permission denied') || code.includes('permission-denied')) {
      setCloudStatus('PERMISSION_DENIED');
    }
    return null;
  }
}

/**
 * Listen for live real-time cloud updates for the authenticated user's private workspace
 */
export function listenToCloud(key, onDataReceived) {
  const docRef = getPrivateUserDocRef(key);
  if (!docRef) return () => {};

  try {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudDoc = docSnap.data();
        if (cloudDoc && cloudDoc.payload !== undefined) {
          setCloudStatus('CONNECTED');
          onDataReceived(cloudDoc.payload);
        }
      }
    }, (err) => {
      const msg = (err.message || '').toLowerCase();
      const code = (err.code || '').toLowerCase();
      if (msg.includes('not_found') || msg.includes('not found') || code.includes('not-found') || msg.includes('does not exist')) {
        setCloudStatus('DATABASE_NOT_CREATED');
      } else if (msg.includes('permission-denied') || msg.includes('permission denied') || code.includes('permission-denied')) {
        setCloudStatus('PERMISSION_DENIED');
      } else {
        setCloudStatus('OFFLINE');
      }
    });
    return unsubscribe;
  } catch (err) {
    setCloudStatus('OFFLINE');
    return () => {};
  }
}

// ----------------------------------------------------
// Authentication Helpers (Email/Password & Google)
// ----------------------------------------------------

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && cred.user) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  return cred.user;
}

const WEB_CLIENT_ID = "1023100975920-9lacvn4166ca2t3f77gcebv81ucp81vs.apps.googleusercontent.com";

// Initialize native GoogleAuth on mobile devices
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true
    });
  } catch (e) {
    console.debug('GoogleAuth init:', e);
  }
}

export async function loginWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true
      });
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication?.idToken || googleUser.idToken;
      if (!idToken) throw new Error('Could not retrieve Google ID Token from native sign in');
      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      return cred.user;
    } catch (err) {
      console.error('Native Google Sign-In error:', err);
      throw err;
    }
  } else {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  }
}

export async function logoutUser() {
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      await GoogleAuth.signOut();
    } catch (e) {
      console.debug('GoogleAuth.signOut error:', e);
    }
  }
  await signOut(auth);
  setCloudStatus('GUEST');
}

export async function resetUserPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// Aliases
export const syncToCloud = pushToCloud;
export const listenToCloudKey = listenToCloud;
