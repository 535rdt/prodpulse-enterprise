import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { triggerHaptic, showToast } from './feedback';

// Prioritized registry of back action handlers: { id, priority, handler }
let backActionHandlers = [];
let lastExitTapTime = 0;

/**
 * Register a back action callback.
 * @param {Function} handler - function that handles the back action. Return true/void to consume, false to skip.
 * @param {number} priority - higher number executes first (e.g. 100 for global menu, 90 for page modals, 80 for select mode, 70 for subtabs).
 * @returns {Function} unregister function
 */
export const registerBackAction = (handler, priority = 50) => {
  const id = Math.random().toString(36).substring(2, 9);
  backActionHandlers.push({ id, priority, handler });
  backActionHandlers.sort((a, b) => b.priority - a.priority);

  return () => {
    backActionHandlers = backActionHandlers.filter(h => h.id !== id);
  };
};

/**
 * React hook to register a back action while a condition is active.
 */
export const useBackAction = (handler, isActive = true, priority = 50) => {
  useEffect(() => {
    if (!isActive) return;
    return registerBackAction(handler, priority);
  }, [isActive, handler, priority]);
};

/**
 * Primary back button processor invoked on Android hardware back button or browser popstate.
 */
export const triggerAppBack = async ({ navigate, location }) => {
  // 1. Check all registered prioritized handlers
  for (const item of [...backActionHandlers]) {
    try {
      const handled = await item.handler();
      if (handled !== false) {
        return true;
      }
    } catch (err) {
      console.warn('Error in back action handler:', err);
    }
  }

  // 2. Fallback DOM check for open modals (look for modal close buttons or backdrops)
  const openModalCloseBtn = document.querySelector(
    '[data-modal-close], .fixed.z-\\[100\\] button.text-slate-400, .fixed.inset-0 button.text-slate-400'
  );
  if (openModalCloseBtn) {
    await triggerHaptic('light');
    openModalCloseBtn.click();
    return true;
  }

  // 3. If currently not on Dashboard ('/'), trace back to Dashboard ('/')
  if (location.pathname !== '/') {
    await triggerHaptic('light');
    navigate('/');
    return true;
  }

  // 4. On Dashboard ('/') with no modals open: Double-tap to exit app
  const now = Date.now();
  if (now - lastExitTapTime < 2000) {
    // Confirmed double tap within 2 seconds -> Exit app!
    await triggerHaptic('heavy');
    try {
      await CapApp.exitApp();
    } catch (err) {
      console.warn('CapApp.exitApp error:', err);
    }
    return true;
  } else {
    // First tap on Dashboard -> Prompt user and start 2s timer
    lastExitTapTime = now;
    await triggerHaptic('light');
    await showToast('Tap back again to exit', 'bottom');
    return true;
  }
};

/**
 * Initializes the Capacitor backButton listener.
 */
export const initBackButtonListener = ({ navigate, locationRef }) => {
  let backListenerHandle = null;

  try {
    const handleBack = () => {
      triggerAppBack({
        navigate,
        location: locationRef.current || { pathname: window.location.hash.replace('#', '') || '/' }
      });
    };

    CapApp.addListener('backButton', () => {
      handleBack();
    }).then(handle => {
      backListenerHandle = handle;
    }).catch(err => {
      console.warn('Could not attach CapApp backButton listener:', err);
    });
  } catch (err) {
    console.warn('initBackButtonListener failed:', err);
  }

  return () => {
    if (backListenerHandle && backListenerHandle.remove) {
      backListenerHandle.remove();
    }
  };
};
