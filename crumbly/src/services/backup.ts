// Back-up: alles als een JSON-bestand bewaren en terugzetten.
import { Platform } from 'react-native';
import { backupOf, useCrumbly, type BackupData } from '../store/store';

export function exportJson(): string {
  return JSON.stringify({ app: 'crumbly', version: 1, exportedAt: new Date().toISOString(), data: backupOf(useCrumbly.getState()) }, null, 2);
}

export function downloadBackup(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `crumbly-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

export function parseBackup(text: string): BackupData | null {
  try {
    const j = JSON.parse(text) as { app?: string; data?: BackupData };
    if (j.app !== 'crumbly' || !j.data || !Array.isArray(j.data.feeds) || !Array.isArray(j.data.recipes) || !Array.isArray(j.data.bakes)) return null;
    return { ...j.data, away: Array.isArray(j.data.away) ? j.data.away : [] };
  } catch {
    return null;
  }
}
