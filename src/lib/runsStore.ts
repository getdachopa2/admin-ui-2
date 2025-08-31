// src/lib/runsStore.ts
import type { RunData, RunStep } from '@/types/n8n';

export type SavedRun = {
  runKey: string;
  savedAt: string;
  data: {
    status: RunData['status'];
    startTime?: string;
    endTime?: string | null;
    steps: RunStep[];
    result?: any;
    params?: any;
  };
};

const KEY = '__kkb_last_runs__';

export function loadRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRun[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: SavedRun) {
  try {
    const current = loadRuns();
    const all = [run, ...current].slice(0, 5);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage kapalıysa sessiz geç
  }
}

// opsiyonel: default export (yanlış import edilse bile çalışsın)
export default { loadRuns, saveRun };
