import { useState, useCallback } from 'react';

/** Translation status type */
export type TranslationStatus = 'idle' | 'translating' | 'done' | 'error';

/** Translation result interface */
interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

/**
 * Custom hook for handling text translation via MyMemory API
 * Uses retry mechanism (up to 3 attempts) and error handling
 */
export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const translate = useCallback(async (
    text: string, 
    sourceLang: string, 
    targetLang: string
  ): Promise<string> => {
    if (!text.trim()) {
      setTranslatedText('');
      return '';
    }

    setStatus('translating');
    setDetectedLang(null);

    const langPair = sourceLang === 'auto' 
      ? `autodetect|${targetLang}` 
      : `${sourceLang}|${targetLang}`;

    let lastError: Error | null = null;

    // Retry mechanism - up to 3 attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json() as TranslationResult & { 
          responseStatus: number;
          responseData: { translatedText: string };
          matches?: Array<{ segment: string; translation: string; source: string }>;
        };

        if (data.responseStatus === 200 || data.responseStatus === undefined) {
          const result = data.responseData.translatedText;
          setTranslatedText(result);
          setStatus('done');

          // Try to detect language from matches
          if (sourceLang === 'auto' && data.matches && data.matches.length > 0) {
            const sourceMatch = data.matches[0]?.source;
            if (sourceMatch) {
              setDetectedLang(sourceMatch);
            }
          }

          return result;
        } else {
          throw new Error(`API error: ${data.responseStatus}`);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Wait before retry (exponential backoff)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    setStatus('error');
    console.error('[TranslationService] All retry attempts failed:', lastError);
    return '';
  }, []);

  const clearTranslation = useCallback(() => {
    setTranslatedText('');
    setStatus('idle');
    setDetectedLang(null);
  }, []);

  return { translate, translatedText, status, detectedLang, clearTranslation, setTranslatedText };
}
