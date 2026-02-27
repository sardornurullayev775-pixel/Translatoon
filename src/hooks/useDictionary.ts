import { useState, useCallback } from 'react';

/** Dictionary entry interface */
export interface DictEntry {
  word: string;
  translation: string;
  partOfSpeech?: string;
  examples?: string[];
  synonyms?: string[];
  phonetic?: string;
}

export interface DictResult {
  entries: DictEntry[];
  sourceLang: string;
  targetLang: string;
}

export type DictStatus = 'idle' | 'searching' | 'done' | 'error' | 'not-found';

/**
 * Custom hook for dictionary/word lookup
 * Uses MyMemory API + free dictionary API
 */
export function useDictionary() {
  const [status, setStatus] = useState<DictStatus>('idle');
  const [result, setResult] = useState<DictResult | null>(null);
  const [savedWords, setSavedWords] = useState<DictEntry[]>(() => {
    try {
      const stored = localStorage.getItem('sardor_saved_words');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  /** Search for a word/phrase translation */
  const searchWord = useCallback(async (
    word: string,
    sourceLang: string,
    targetLang: string
  ) => {
    if (!word.trim()) {
      setResult(null);
      setStatus('idle');
      return;
    }

    setStatus('searching');

    try {
      // Use MyMemory for translation
      const langPair = sourceLang === 'auto' 
        ? `autodetect|${targetLang}` 
        : `${sourceLang}|${targetLang}`;
      
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${langPair}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.responseStatus === 200 || data.responseStatus === undefined) {
        const mainTranslation = data.responseData.translatedText;
        
        // Build entries from matches
        const entries: DictEntry[] = [];
        
        // Main translation
        entries.push({
          word: word,
          translation: mainTranslation,
          partOfSpeech: 'tarjima',
        });

        // Additional matches from MyMemory
        if (data.matches && Array.isArray(data.matches)) {
          const seen = new Set<string>([mainTranslation.toLowerCase()]);
          
          for (const match of data.matches.slice(0, 8)) {
            const trans = match.translation?.trim();
            if (trans && !seen.has(trans.toLowerCase()) && trans.toLowerCase() !== word.toLowerCase()) {
              seen.add(trans.toLowerCase());
              entries.push({
                word: match.segment || word,
                translation: trans,
                partOfSpeech: match.quality ? `sifat: ${Math.round(match.quality)}%` : undefined,
              });
            }
          }
        }

        // Also try free dictionary API for English words
        if (sourceLang === 'en' || sourceLang === 'auto') {
          try {
            const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (dictRes.ok) {
              const dictData = await dictRes.json();
              if (Array.isArray(dictData) && dictData.length > 0) {
                const firstEntry = dictData[0];
                
                // Add phonetic
                if (firstEntry.phonetic && entries[0]) {
                  entries[0].phonetic = firstEntry.phonetic;
                }

                // Add meanings
                if (firstEntry.meanings) {
                  for (const meaning of firstEntry.meanings.slice(0, 3)) {
                    const defs = meaning.definitions?.slice(0, 2) || [];
                    const examples = defs
                      .filter((d: { example?: string }) => d.example)
                      .map((d: { example: string }) => d.example);
                    
                    const synonyms = meaning.synonyms?.slice(0, 5) || [];

                    if (entries[0]) {
                      if (examples.length > 0) entries[0].examples = examples;
                      if (synonyms.length > 0) entries[0].synonyms = synonyms;
                    }
                  }
                }
              }
            }
          } catch {
            // Dictionary API is optional, ignore errors
          }
        }

        if (entries.length === 0) {
          setStatus('not-found');
          setResult(null);
        } else {
          setResult({ entries, sourceLang, targetLang });
          setStatus('done');
        }
      } else {
        setStatus('not-found');
        setResult(null);
      }
    } catch (err) {
      console.error('[Dictionary] Search error:', err);
      setStatus('error');
      setResult(null);
    }
  }, []);

  /** Save word to favorites */
  const saveWord = useCallback((entry: DictEntry) => {
    setSavedWords(prev => {
      const exists = prev.some(w => w.word === entry.word && w.translation === entry.translation);
      if (exists) return prev;
      const updated = [entry, ...prev].slice(0, 50);
      try { localStorage.setItem('sardor_saved_words', JSON.stringify(updated)); } catch { /* */ }
      return updated;
    });
  }, []);

  /** Remove word from favorites */
  const removeWord = useCallback((word: string) => {
    setSavedWords(prev => {
      const updated = prev.filter(w => w.word !== word);
      try { localStorage.setItem('sardor_saved_words', JSON.stringify(updated)); } catch { /* */ }
      return updated;
    });
  }, []);

  /** Clear dictionary results */
  const clearDict = useCallback(() => {
    setResult(null);
    setStatus('idle');
  }, []);

  return { searchWord, result, status, savedWords, saveWord, removeWord, clearDict };
}
