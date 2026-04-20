import { notifyBottomLine } from '../../shared/generic-grid/utils';
import { DialogService } from '../../../services/dialog.service';

type PromptDialogOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  inputType?: string;
};

function getDialogService(): typeof DialogService {
  return ((typeof window !== 'undefined' && (window as any).DialogService)
    || (globalThis as any).DialogService
    || DialogService) as typeof DialogService;
}

export async function promptText(
  message: string,
  defaultValue: string = '',
  options: PromptDialogOptions = {},
): Promise<string | null> {
  try {
    return await getDialogService().prompt(message, defaultValue, options);
  } catch {
    try {
      if (typeof globalThis.prompt === 'function') {
        return globalThis.prompt(message, defaultValue);
      }
    } catch {
      // ignore fallback errors
    }
    return null;
  }
}

export async function confirmAction(message: string, title = 'Potwierdź'): Promise<boolean> {
  try {
    return await getDialogService().confirm(message, { title });
  } catch {
    try {
      if (typeof globalThis.confirm === 'function') {
        return !!globalThis.confirm(message);
      }
    } catch {
      // ignore fallback errors
    }
    return false;
  }
}

export async function showInfoDialog(message: string, title = 'Informacja'): Promise<void> {
  try {
    const dialogService = getDialogService() as typeof DialogService & { alert?: (message: string, options?: { title?: string; confirmText?: string }) => Promise<void> };
    if (typeof dialogService.alert === 'function') {
      await dialogService.alert(message, { title, confirmText: 'OK' });
      return;
    }
  } catch {
    // ignore dialog errors and fall back to toast
  }
  notifyBottomLine(String(message || '').replace(/\s+/g, ' ').trim(), 'info', 4000);
}
