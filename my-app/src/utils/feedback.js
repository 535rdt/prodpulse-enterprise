import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Toast } from '@capacitor/toast';

export const triggerHaptic = async (style = 'medium') => {
  try {
    if (style === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (style === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (style === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (style === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch (err) {
    // Haptics may not be supported on web/desktop, suppress safely
  }
};

export const showToast = async (text, position = 'bottom') => {
  try {
    await Toast.show({
      text,
      duration: 'short',
      position
    });
  } catch (err) {
    // Fallback in-app or alert if toast fails
    console.log(`[Toast] ${text}`);
  }
};

export const shareOrCopy = async ({ title, text, jsonString }) => {
  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text,
      });
      await showToast('Export shared successfully!');
      return;
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Share error', err);
    } else {
      return;
    }
  }

  // Fallback: Copy to clipboard or trigger download
  try {
    if (navigator.clipboard && jsonString) {
      await navigator.clipboard.writeText(jsonString);
      await triggerHaptic('success');
      await showToast('Data copied to clipboard!');
      return;
    }
  } catch (err) {
    console.warn('Clipboard write error', err);
  }

  // Final fallback: Browser download
  if (jsonString) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    await showToast('File saved!');
  }
};

export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write error', err);
  }
  return false;
};
