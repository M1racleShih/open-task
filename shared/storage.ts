// Browsers may deny even access to localStorage (privacy modes / embedded views).
export const localPreferences = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage.setItem(key, value);
    } catch {
      // Preferences remain usable in memory when storage is unavailable or full.
    }
  },
};
