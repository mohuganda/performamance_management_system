import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await get<string>(name);
      if (value !== undefined) return value;
      // Fallback to localStorage for quick sync reads
      return localStorage.getItem(name);
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

