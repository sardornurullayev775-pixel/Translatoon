import { useState, useCallback, useEffect } from 'react';

/** History item interface */
export interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

const STORAGE_KEY = 'sardor_translator_history';
const MAX_ITEMS = 10;

/**
 * Custom hook for managing translation history
 * Uses localStorage for persistence
 */
export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryItem[];
        setHistory(parsed);
      }
    } catch (err) {
      console.error('[HistoryManager] Load error:', err);
    }
  }, []);

  // Save to localStorage whenever history changes
  const persist = useCallback((items: HistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('[HistoryManager] Save error:', err);
    }
  }, []);

  /** Add a new translation to history */
  const addToHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_ITEMS);
      persist(updated);
      return updated;
    });
  }, [persist]);

  /** Clear all history */
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[HistoryManager] Clear error:', err);
    }
  }, []);

  return { history, addToHistory, clearHistory };
}
