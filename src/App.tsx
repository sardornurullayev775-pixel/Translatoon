import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { LANGUAGES, getLanguageByCode, getTargetLanguages } from './constants/languages';
import { useTranslation } from './hooks/useTranslation';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useHistory, type HistoryItem } from './hooks/useHistory';
import { useDictionary } from './hooks/useDictionary';
import { useVideoTranslation } from './hooks/useVideoTranslation';

type AppStatus = 'idle' | 'listening' | 'translating' | 'done' | 'error';
type TabType = 'voice' | 'dictionary' | 'video';

export function App() {
  // ===== THEME =====
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('sardor_theme') === 'dark'; } catch { return false; }
  });

  // ===== TABS =====
  const [activeTab, setActiveTab] = useState<TabType>('voice');

  // ===== VOICE TRANSLATOR STATE =====
  const [sourceLang, setSourceLang] = useState('uz');
  const [targetLang, setTargetLang] = useState('en');
  const [sourceText, setSourceText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [appStatus, setAppStatus] = useState<AppStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [fontSize, setFontSize] = useState(16);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  // ===== DICTIONARY STATE =====
  const [dictQuery, setDictQuery] = useState('');
  const [dictSourceLang, setDictSourceLang] = useState('en');
  const [dictTargetLang, setDictTargetLang] = useState('uz');
  const [showSavedWords, setShowSavedWords] = useState(false);

  // ===== VIDEO STATE =====
  const [videoSourceLang, setVideoSourceLang] = useState('en');
  const [videoTargetLang, setVideoTargetLang] = useState('uz');
  const [isDragOver, setIsDragOver] = useState(false);

  // ===== REFS =====
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== HOOKS =====
  const { translate, translatedText, status: translationStatus, detectedLang, clearTranslation, setTranslatedText } = useTranslation();
  const { history, addToHistory, clearHistory } = useHistory();
  const { searchWord, result: dictResult, status: dictStatus, savedWords, saveWord, removeWord, clearDict } = useDictionary();
  const {
    videoUrl, videoName, status: videoStatus, progress: videoProgress,
    originalText: videoOriginalText, translatedText: videoTranslatedText,
    subtitles, errorMsg: videoError, videoRef,
    loadVideo, extractAndTranscribe, stopProcessing, clearVideo, formatTime
  } = useVideoTranslation();

  // Speech code
  const speechCode = useMemo(() => {
    if (sourceLang === 'auto') return 'en-US';
    return getLanguageByCode(sourceLang)?.speechCode || 'en-US';
  }, [sourceLang]);

  const speechCallbacks = useMemo(() => ({
    onInterimResult: (text: string) => setInterimText(text),
    onFinalResult: (text: string) => {
      setSourceText(prev => prev + (prev ? ' ' : '') + text);
      setInterimText('');
    },
    onError: (error: string) => {
      setAppStatus('error');
      setErrorMsg(error === 'not-allowed' ? 'Mikrofonga ruxsat berilmagan' : `Xato: ${error}`);
    },
  }), []);

  const { status: speechStatus, isSupported, startListening, stopListening } = useSpeechRecognition(speechCode, speechCallbacks);

  // ===== THEME EFFECT =====
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('sardor_theme', darkMode ? 'dark' : 'light'); } catch { /* */ }
  }, [darkMode]);

  // ===== STATUS EFFECTS =====
  useEffect(() => {
    if (speechStatus === 'listening') setAppStatus('listening');
    else if (translationStatus === 'translating') setAppStatus('translating');
    else if (translationStatus === 'done') {
      setAppStatus('done');
      const t = setTimeout(() => setAppStatus('idle'), 3000);
      return () => clearTimeout(t);
    } else if (translationStatus === 'error' || speechStatus === 'error') setAppStatus('error');
  }, [speechStatus, translationStatus]);

  // Auto-translate
  useEffect(() => {
    if (!sourceText.trim()) return;
    const t = setTimeout(() => handleTranslate(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText, targetLang, sourceLang]);

  // Space shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body && activeTab === 'voice') {
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechStatus, activeTab]);

  // Save/load settings
  useEffect(() => {
    try {
      localStorage.setItem('sardor_settings', JSON.stringify({
        sourceLang, targetLang, speechRate, speechVolume, fontSize, dictSourceLang, dictTargetLang
      }));
    } catch { /* */ }
  }, [sourceLang, targetLang, speechRate, speechVolume, fontSize, dictSourceLang, dictTargetLang]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('sardor_settings');
      if (s) {
        const p = JSON.parse(s);
        if (p.sourceLang) setSourceLang(p.sourceLang);
        if (p.targetLang) setTargetLang(p.targetLang);
        if (p.speechRate) setSpeechRate(p.speechRate);
        if (p.speechVolume) setSpeechVolume(p.speechVolume);
        if (p.fontSize) setFontSize(p.fontSize);
        if (p.dictSourceLang) setDictSourceLang(p.dictSourceLang);
        if (p.dictTargetLang) setDictTargetLang(p.dictTargetLang);
      }
    } catch { /* */ }
  }, []);

  // Close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.source-dd')) setShowSourceDropdown(false);
      if (!t.closest('.target-dd')) setShowTargetDropdown(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ===== HANDLERS =====
  const toggleMic = useCallback(() => {
    if (speechStatus === 'listening') stopListening();
    else { setErrorMsg(''); startListening(); }
  }, [speechStatus, startListening, stopListening]);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;
    const r = await translate(sourceText, sourceLang, targetLang);
    if (r) addToHistory({ sourceText, translatedText: r, sourceLang: detectedLang || sourceLang, targetLang });
  }, [sourceText, sourceLang, targetLang, translate, addToHistory, detectedLang]);

  const speakText = useCallback((text: string, lang: string) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = getLanguageByCode(lang)?.speechCode || 'en-US';
    u.rate = speechRate;
    u.volume = speechVolume;
    window.speechSynthesis.speak(u);
  }, [speechRate, speechVolume]);

  const copyText = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const clearAll = useCallback(() => {
    setSourceText(''); setInterimText('');
    clearTranslation(); setAppStatus('idle'); setErrorMsg('');
  }, [clearTranslation]);

  const swapLanguages = useCallback(() => {
    if (sourceLang === 'auto') return;
    setIsSwapping(true);
    const ts = sourceLang, tt = targetLang, tst = sourceText, ttt = translatedText;
    setSourceLang(tt); setTargetLang(ts); setSourceText(ttt); setTranslatedText(tst);
    setTimeout(() => setIsSwapping(false), 400);
  }, [sourceLang, targetLang, sourceText, translatedText, setTranslatedText]);

  const loadFromHistory = useCallback((item: HistoryItem) => {
    setSourceLang(item.sourceLang); setTargetLang(item.targetLang);
    setSourceText(item.sourceText); setTranslatedText(item.translatedText);
    setShowHistory(false);
  }, [setTranslatedText]);

  // Dictionary handlers
  const handleDictSearch = useCallback(() => {
    if (dictQuery.trim()) searchWord(dictQuery.trim(), dictSourceLang, dictTargetLang);
  }, [dictQuery, dictSourceLang, dictTargetLang, searchWord]);

  // Video handlers
  const handleVideoFile = useCallback((file: File) => {
    loadVideo(file);
  }, [loadVideo]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVideoFile(file);
  }, [handleVideoFile]);

  // (filtered langs handled inside renderLangDropdown)

  // ===== RENDER HELPERS =====
  const renderStatus = () => {
    const statuses: Record<AppStatus, React.ReactNode> = {
      listening: (
        <div className="flex items-center gap-2 animate-fade-in-up">
          <span className="status-dot status-dot-listening" />
          <span className="text-success text-sm font-medium">🎙 Tinglayapman...</span>
        </div>
      ),
      translating: (
        <div className="flex items-center gap-2 animate-fade-in-up">
          <div className="w-4 h-4 border-2 border-warning border-t-transparent rounded-full animate-spin-slow" />
          <span className="text-warning text-sm font-medium">⚡ Tarjima qilyapman...</span>
        </div>
      ),
      done: (
        <div className="flex items-center gap-2 animate-fade-in-up animate-success-flash rounded-lg px-2 py-1">
          <span className="text-secondary text-sm font-medium">✅ Tayyor!</span>
        </div>
      ),
      error: (
        <div className="flex items-center gap-2 animate-shake">
          <span className="status-dot status-dot-error" />
          <span className="text-danger text-sm font-medium">❌ {errorMsg || 'Xato yuz berdi'}</span>
        </div>
      ),
      idle: (
        <div className="flex items-center gap-2">
          <span className="text-base-muted text-sm">Tayyor. Mikrofon bosing yoki matn yozing.</span>
        </div>
      ),
    };
    return statuses[appStatus];
  };

  const renderVisualizer = () => (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i}
          className={`wave-bar ${speechStatus === 'listening' ? 'wave-bar-active' : 'wave-bar-idle'}`}
          style={{ height: speechStatus === 'listening' ? undefined : '4px', animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );

  const renderLangDropdown = (
    value: string, onChange: (v: string) => void,
    showAuto: boolean, containerClass: string,
    isOpen: boolean, setIsOpen: (v: boolean) => void,
    search: string, setSearch: (v: string) => void
  ) => {
    const langs = showAuto ? LANGUAGES : getTargetLanguages();
    const filtered = search
      ? langs.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.nativeName.toLowerCase().includes(search.toLowerCase()))
      : langs;

    return (
      <div className={`flex-1 relative ${containerClass}`}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="w-full glass rounded-xl px-3 py-2.5 flex items-center gap-2 bg-hover transition-all text-left"
        >
          <span className="text-lg">{getLanguageByCode(value)?.flag || '🌐'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-base-primary text-sm font-medium truncate">{getLanguageByCode(value)?.name || 'Til'}</div>
            <div className="text-base-muted text-[10px] truncate">{getLanguageByCode(value)?.nativeName}</div>
          </div>
          <svg className={`w-3 h-3 text-base-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 glass-strong rounded-xl overflow-hidden z-30 shadow-2xl max-h-[280px] flex flex-col">
            <div className="p-2">
              <input
                type="text" placeholder="🔍 Til izlash..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-input rounded-lg px-3 py-2 text-base-primary text-sm placeholder:text-base-muted focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map(lang => (
                <button key={lang.code}
                  onClick={() => { onChange(lang.code); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 flex items-center gap-2 bg-hover transition-colors text-left ${value === lang.code ? 'bg-primary/20' : ''}`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-base-primary text-sm">{lang.name}</span>
                    <span className="text-base-muted text-xs ml-1">({lang.nativeName})</span>
                  </div>
                  {value === lang.code && <span className="text-primary text-sm">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* ===== HEADER ===== */}
      <header className="py-3 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold gradient-text">Sardor</h1>
            <p className="text-[10px] md:text-xs text-base-muted">Ovozli Tarjimon • Lugat • Video</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center bg-hover transition-all" title="Sozlamalar">
            <svg className="w-4 h-4 text-base-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button onClick={() => setDarkMode(!darkMode)}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center bg-hover transition-all" title={darkMode ? "Kunduzgi rejim ☀️" : "Tungi rejim 🌙"}>
            {darkMode ? (
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button onClick={() => setShowHistory(!showHistory)}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center bg-hover transition-all relative" title="Tarix">
            <svg className="w-4 h-4 text-base-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-white flex items-center justify-center font-bold">{history.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* ===== SETTINGS ===== */}
      {showSettings && (
        <div className="px-4 md:px-8 pb-3 animate-fade-in-down">
          <div className="glass-strong rounded-2xl p-4 max-w-2xl mx-auto">
            <h3 className="text-base-primary text-sm font-semibold mb-3">⚙️ Sozlamalar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-base-muted text-xs block mb-1">Ovoz tezligi: {speechRate.toFixed(1)}x</label>
                <input type="range" min="0.5" max="2" step="0.1" value={speechRate} onChange={e => setSpeechRate(parseFloat(e.target.value))} className="w-full h-1" />
              </div>
              <div>
                <label className="text-base-muted text-xs block mb-1">Ovoz balandligi: {Math.round(speechVolume * 100)}%</label>
                <input type="range" min="0" max="1" step="0.1" value={speechVolume} onChange={e => setSpeechVolume(parseFloat(e.target.value))} className="w-full h-1" />
              </div>
              <div>
                <label className="text-base-muted text-xs block mb-1">Matn o'lchami: {fontSize}px</label>
                <input type="range" min="12" max="24" step="1" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-1" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TABS ===== */}
      <div className="px-4 md:px-8 mb-3">
        <div className="flex items-center justify-center gap-1 max-w-2xl mx-auto">
          {[
            { key: 'voice' as TabType, label: '🎙 Ovozli Tarjimon', icon: '🎙' },
            { key: 'dictionary' as TabType, label: '📖 Lugat', icon: '📖' },
            { key: 'video' as TabType, label: '🎬 Video Tarjimon', icon: '🎬' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'tab-btn-active glass-strong text-primary shadow-lg'
                  : 'glass text-base-muted bg-hover'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex items-start justify-center px-4 md:px-8 py-2">
        <div className="w-full max-w-3xl">

          {/* ==================== VOICE TAB ==================== */}
          {activeTab === 'voice' && (
            <div className="glass-strong rounded-3xl p-4 md:p-6 animate-fade-in-up">
              {/* Language Selector */}
              <div className="flex items-center gap-2 md:gap-4 mb-5">
                {renderLangDropdown(sourceLang, setSourceLang, true, 'source-dd', showSourceDropdown, setShowSourceDropdown, sourceSearch, setSourceSearch)}
                
                <button onClick={swapLanguages} disabled={sourceLang === 'auto'}
                  className={`w-10 h-10 rounded-full glass flex items-center justify-center transition-all bg-hover hover:scale-110 ${sourceLang === 'auto' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${isSwapping ? 'animate-swap' : ''}`}>
                  <svg className="w-4 h-4 text-base-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </button>

                {renderLangDropdown(targetLang, setTargetLang, false, 'target-dd', showTargetDropdown, setShowTargetDropdown, targetSearch, setTargetSearch)}
              </div>

              {/* Detected language badge */}
              {detectedLang && sourceLang === 'auto' && (
                <div className="text-center mb-3 animate-fade-in-up">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full glass text-xs text-secondary">
                    🔍 Aniqlandi: {detectedLang.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Mic + Visualizer */}
              <div className="flex flex-col items-center mb-5">
                <div className="mb-3">{renderVisualizer()}</div>
                <div className="relative">
                  {speechStatus === 'listening' && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-danger/30 animate-pulse-ring" style={{ animationDelay: '0s' }} />
                      <div className="absolute inset-0 rounded-full bg-danger/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                      <div className="absolute inset-0 rounded-full bg-danger/10 animate-pulse-ring" style={{ animationDelay: '1s' }} />
                    </>
                  )}
                  <button onClick={toggleMic} disabled={!isSupported}
                    className={`relative z-10 w-[100px] h-[100px] md:w-[120px] md:h-[120px] rounded-full mic-btn flex items-center justify-center shadow-xl transition-all ${speechStatus === 'listening' ? 'mic-btn-active' : ''} ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={speechStatus === 'listening' ? "To'xtatish" : "Tinglash (Space)"}>
                    <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {speechStatus === 'listening' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      )}
                    </svg>
                  </button>
                </div>
                {!isSupported && <p className="text-danger text-xs mt-2 text-center">⚠️ Brauzeringiz qo'llab-quvvatlamaydi. Chrome ishlating.</p>}
                <p className="text-base-hint text-[10px] mt-2">Space — mikrofon yoqish/o'chirish</p>
              </div>

              {/* Text Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="glass-card rounded-2xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base-muted text-xs font-medium uppercase tracking-wider">Asl matn</span>
                    <span className="text-base-hint text-[10px]">{sourceText.length} belgi</span>
                  </div>
                  <div ref={sourceRef} className="text-display flex-1 min-h-[100px] max-h-[160px] overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
                    {sourceText && <span className="text-base-primary leading-relaxed">{sourceText}</span>}
                    {interimText && <span className="text-base-muted italic leading-relaxed"> {interimText}</span>}
                    {!sourceText && !interimText && <span className="text-base-hint italic">Mikrofon bosing yoki matn yozing...</span>}
                  </div>
                  <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} placeholder="Matn yozing..."
                    className="mt-2 w-full bg-input rounded-lg px-3 py-2 text-base-primary text-sm placeholder:text-base-hint focus:outline-none focus:ring-1 focus:ring-primary resize-none h-10"
                    style={{ fontSize: `${Math.max(12, fontSize - 2)}px` }} />
                </div>
                <div className={`glass-card rounded-2xl p-4 flex flex-col ${appStatus === 'done' ? 'animate-success-flash' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base-muted text-xs font-medium uppercase tracking-wider">Tarjima</span>
                    <span className="text-base-hint text-[10px]">{translatedText.length} belgi</span>
                  </div>
                  <div ref={targetRef} className="text-display flex-1 min-h-[100px] max-h-[160px] overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
                    {translationStatus === 'translating' ? (
                      <div className="flex items-center gap-2 text-base-muted">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin-slow" />
                        <span className="italic text-sm">Tarjima qilinmoqda...</span>
                      </div>
                    ) : translatedText ? (
                      <span className="text-base-primary leading-relaxed animate-fade-in-up">{translatedText}</span>
                    ) : (
                      <span className="text-base-hint italic">Tarjima bu yerda paydo bo'ladi...</span>
                    )}
                  </div>
                  <div className="h-10" />
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <button onClick={() => speakText(translatedText, targetLang)} disabled={!translatedText}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full glass bg-hover transition-all text-sm font-medium text-base-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:translate-y-[-1px]">
                  <span>🔊</span> Ovoz chiqarish
                </button>
                <button onClick={() => copyText(translatedText)} disabled={!translatedText}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full glass bg-hover transition-all text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:translate-y-[-1px] ${copied ? 'text-success' : 'text-base-secondary'}`}>
                  <span>{copied ? '✅' : '📋'}</span> {copied ? 'Nusxa olindi!' : 'Nusxa olish'}
                </button>
                <button onClick={clearAll}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full glass transition-all text-sm font-medium text-base-secondary hover:text-danger hover:translate-y-[-1px]">
                  <span>🗑</span> Tozalash
                </button>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-center min-h-[28px]">{renderStatus()}</div>
            </div>
          )}

          {/* ==================== DICTIONARY TAB ==================== */}
          {activeTab === 'dictionary' && (
            <div className="glass-strong rounded-3xl p-4 md:p-6 animate-fade-in-up">
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold gradient-text mb-1">📖 Lugat</h2>
                <p className="text-base-muted text-xs">So'z yoki iborani qidiring va tarjimasini oling</p>
              </div>

              {/* Dict Language Selector */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1">
                  <select value={dictSourceLang} onChange={e => setDictSourceLang(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2.5 text-base-primary text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                    {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                      <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => { const t = dictSourceLang; setDictSourceLang(dictTargetLang); setDictTargetLang(t); }}
                  className="w-10 h-10 rounded-full glass flex items-center justify-center bg-hover transition-all hover:scale-110">
                  <svg className="w-4 h-4 text-base-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </button>
                <div className="flex-1">
                  <select value={dictTargetLang} onChange={e => setDictTargetLang(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2.5 text-base-primary text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                    {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                      <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Input */}
              <div className="flex gap-2 mb-5">
                <div className="flex-1 relative">
                  <input type="text" value={dictQuery}
                    onChange={e => setDictQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDictSearch()}
                    placeholder="So'z yoki ibora kiriting..."
                    className="w-full glass rounded-xl px-4 py-3 pr-10 text-base-primary text-sm placeholder:text-base-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {dictQuery && (
                    <button onClick={() => { setDictQuery(''); clearDict(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted hover:text-danger transition-colors">
                      ✕
                    </button>
                  )}
                </div>
                <button onClick={handleDictSearch} disabled={!dictQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-medium text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:translate-y-[-1px]">
                  🔍 Qidirish
                </button>
              </div>

              {/* Saved words toggle */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setShowSavedWords(!showSavedWords)}
                  className="flex items-center gap-2 text-sm text-base-muted bg-hover px-3 py-1.5 rounded-lg transition-all">
                  <span>⭐</span>
                  <span>Saqlangan so'zlar ({savedWords.length})</span>
                  <svg className={`w-3 h-3 transition-transform ${showSavedWords ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Saved Words Panel */}
              {showSavedWords && (
                <div className="mb-4 animate-fade-in-down">
                  <div className="glass-card rounded-xl p-3 max-h-[200px] overflow-y-auto">
                    {savedWords.length === 0 ? (
                      <p className="text-center text-base-muted text-xs py-4">Hali saqlangan so'z yo'q. ⭐ tugmasini bosing.</p>
                    ) : (
                      <div className="space-y-2">
                        {savedWords.map((w, i) => (
                          <div key={i} className="flex items-center justify-between glass rounded-lg px-3 py-2 dict-entry">
                            <div className="flex-1">
                              <span className="text-base-primary text-sm font-medium">{w.word}</span>
                              <span className="text-primary text-sm ml-2">→ {w.translation}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => speakText(w.word, dictSourceLang)} className="p-1 text-xs bg-hover rounded">🔊</button>
                              <button onClick={() => removeWord(w.word)} className="p-1 text-xs text-danger bg-hover rounded">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Search Status */}
              {dictStatus === 'searching' && (
                <div className="flex items-center justify-center gap-2 py-8 animate-fade-in-up">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin-slow" />
                  <span className="text-base-muted text-sm">Qidirilmoqda...</span>
                </div>
              )}

              {dictStatus === 'not-found' && (
                <div className="text-center py-8 animate-shake">
                  <p className="text-4xl mb-2">🤷</p>
                  <p className="text-base-muted text-sm">Natija topilmadi. Boshqa so'z yozing.</p>
                </div>
              )}

              {dictStatus === 'error' && (
                <div className="text-center py-8 animate-shake">
                  <p className="text-4xl mb-2">❌</p>
                  <p className="text-danger text-sm">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
                </div>
              )}

              {/* Results */}
              {dictResult && dictStatus === 'done' && (
                <div className="space-y-3 animate-fade-in-up">
                  {dictResult.entries.map((entry, i) => (
                    <div key={i} className="glass-card rounded-2xl p-4 dict-entry">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base-primary text-lg font-bold">{entry.word}</h3>
                            {entry.phonetic && <span className="text-base-muted text-sm">{entry.phonetic}</span>}
                            {entry.partOfSpeech && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{entry.partOfSpeech}</span>
                            )}
                          </div>
                          <p className="text-primary text-base font-semibold mt-1">→ {entry.translation}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button onClick={() => speakText(entry.word, dictSourceLang)}
                            className="w-8 h-8 rounded-lg glass flex items-center justify-center bg-hover text-sm" title="Talaffuz">
                            🔊
                          </button>
                          <button onClick={() => speakText(entry.translation, dictTargetLang)}
                            className="w-8 h-8 rounded-lg glass flex items-center justify-center bg-hover text-sm" title="Tarjima talaffuzi">
                            🗣
                          </button>
                          <button onClick={() => saveWord(entry)}
                            className={`w-8 h-8 rounded-lg glass flex items-center justify-center bg-hover text-sm ${savedWords.some(w => w.word === entry.word) ? 'text-yellow-400' : ''}`} title="Saqlash">
                            {savedWords.some(w => w.word === entry.word) ? '⭐' : '☆'}
                          </button>
                          <button onClick={() => copyText(entry.translation)}
                            className="w-8 h-8 rounded-lg glass flex items-center justify-center bg-hover text-sm" title="Nusxa">
                            📋
                          </button>
                        </div>
                      </div>

                      {/* Examples */}
                      {entry.examples && entry.examples.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-base-muted text-xs font-semibold uppercase">Misollar:</p>
                          {entry.examples.map((ex, j) => (
                            <p key={j} className="text-base-secondary text-sm italic pl-3 border-l-2 border-primary/30">"{ex}"</p>
                          ))}
                        </div>
                      )}

                      {/* Synonyms */}
                      {entry.synonyms && entry.synonyms.length > 0 && (
                        <div className="mt-3">
                          <p className="text-base-muted text-xs font-semibold uppercase mb-1">Sinonimlar:</p>
                          <div className="flex flex-wrap gap-1">
                            {entry.synonyms.map((syn, j) => (
                              <button key={j} onClick={() => { setDictQuery(syn); searchWord(syn, dictSourceLang, dictTargetLang); }}
                                className="px-2 py-0.5 rounded-full glass text-xs text-secondary bg-hover cursor-pointer">
                                {syn}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {dictStatus === 'idle' && !dictQuery && (
                <div className="text-center py-8">
                  <p className="text-5xl mb-3">📚</p>
                  <p className="text-base-muted text-sm">So'z kiriting va "Qidirish" tugmasini bosing</p>
                  <p className="text-base-hint text-xs mt-1">yoki Enter tugmasini bosing</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== VIDEO TAB ==================== */}
          {activeTab === 'video' && (
            <div className="glass-strong rounded-3xl p-4 md:p-6 animate-fade-in-up">
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold gradient-text mb-1">🎬 Video Tarjimon</h2>
                <p className="text-base-muted text-xs">Video yuklang, ovozni aniqlang va tarjima qiling</p>
              </div>

              {/* Video Language Selector */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1">
                  <label className="text-base-muted text-[10px] block mb-1">Video tili</label>
                  <select value={videoSourceLang} onChange={e => setVideoSourceLang(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2.5 text-base-primary text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                    {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                      <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-4">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <label className="text-base-muted text-[10px] block mb-1">Tarjima tili</label>
                  <select value={videoTargetLang} onChange={e => setVideoTargetLang(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2.5 text-base-primary text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                    {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                      <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Area */}
              {!videoUrl && (
                <div
                  className={`drop-zone rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }} />
                  
                  <div className={`text-5xl mb-3 ${isDragOver ? 'animate-bounce-subtle' : ''}`}>
                    {isDragOver ? '📥' : '🎬'}
                  </div>
                  <p className="text-base-primary text-sm font-medium mb-1">
                    {isDragOver ? 'Qo\'yib yuboring!' : 'Video faylni bu yerga tashlang'}
                  </p>
                  <p className="text-base-muted text-xs mb-3">yoki bosib tanlang</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full glass text-[10px] text-base-muted">MP4</span>
                    <span className="px-2 py-0.5 rounded-full glass text-[10px] text-base-muted">WebM</span>
                    <span className="px-2 py-0.5 rounded-full glass text-[10px] text-base-muted">OGG</span>
                    <span className="px-2 py-0.5 rounded-full glass text-[10px] text-base-muted">Max 100MB</span>
                  </div>
                </div>
              )}

              {/* Video Player */}
              {videoUrl && (
                <div className="space-y-4">
                  <div className="video-container glass-card rounded-2xl overflow-hidden">
                    <video ref={videoRef} src={videoUrl} controls className="w-full max-h-[300px]" />
                  </div>

                  {/* File info */}
                  <div className="flex items-center justify-between glass rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>🎬</span>
                      <span className="text-base-primary text-sm truncate max-w-[200px]">{videoName}</span>
                    </div>
                    <button onClick={clearVideo} className="text-danger text-xs bg-hover px-2 py-1 rounded-lg transition-all">
                      ✕ O'chirish
                    </button>
                  </div>

                  {/* Progress bar */}
                  {(videoStatus === 'extracting' || videoStatus === 'translating') && (
                    <div className="space-y-2 animate-fade-in-up">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-base-muted">
                          {videoStatus === 'extracting' ? '🎙 Ovoz aniqlanmoqda...' : '⚡ Tarjima qilinmoqda...'}
                        </span>
                        <span className="text-primary font-mono">{Math.round(videoProgress)}%</span>
                      </div>
                      <div className="h-2 rounded-full glass overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                          style={{ width: `${videoProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(videoStatus === 'ready' || videoStatus === 'done') && (
                      <button onClick={() => extractAndTranscribe(videoSourceLang, videoTargetLang)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-medium text-sm shadow-lg hover:opacity-90 hover:translate-y-[-1px] transition-all">
                        <span>▶️</span> {videoStatus === 'done' ? 'Qayta tarjima' : 'Tarjimani boshlash'}
                      </button>
                    )}
                    {(videoStatus === 'extracting' || videoStatus === 'translating') && (
                      <button onClick={stopProcessing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass text-danger font-medium text-sm bg-hover transition-all">
                        <span>⏹</span> To'xtatish
                      </button>
                    )}
                  </div>

                  {/* Error */}
                  {videoStatus === 'error' && videoError && (
                    <div className="glass-card rounded-xl p-3 border-l-4 border-danger animate-shake">
                      <p className="text-danger text-sm">❌ {videoError}</p>
                    </div>
                  )}

                  {/* Info note */}
                  {videoStatus === 'ready' && (
                    <div className="glass-card rounded-xl p-3 border-l-4 border-warning">
                      <p className="text-base-secondary text-xs">
                        💡 <strong>Eslatma:</strong> Video ovozi mikrofon orqali aniqlanadi. 
                        Videoni ovoz chiqarib tinglang va atrofda jim bo'ling. 
                        Chrome brauzeridan foydalanish tavsiya etiladi.
                      </p>
                    </div>
                  )}

                  {/* Results */}
                  {(videoOriginalText || videoTranslatedText) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Original */}
                      <div className="glass-card rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base-muted text-xs font-medium uppercase tracking-wider">
                            Asl matn ({getLanguageByCode(videoSourceLang)?.flag})
                          </span>
                          <button onClick={() => copyText(videoOriginalText)} className="text-xs text-base-muted bg-hover px-2 py-0.5 rounded">📋</button>
                        </div>
                        <div className="text-display min-h-[80px] max-h-[200px] overflow-y-auto">
                          <p className="text-base-primary text-sm leading-relaxed">{videoOriginalText || 'Kutilmoqda...'}</p>
                        </div>
                      </div>
                      
                      {/* Translation */}
                      <div className={`glass-card rounded-2xl p-4 ${videoStatus === 'done' ? 'animate-success-flash' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base-muted text-xs font-medium uppercase tracking-wider">
                            Tarjima ({getLanguageByCode(videoTargetLang)?.flag})
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => speakText(videoTranslatedText, videoTargetLang)} className="text-xs text-base-muted bg-hover px-2 py-0.5 rounded">🔊</button>
                            <button onClick={() => copyText(videoTranslatedText)} className="text-xs text-base-muted bg-hover px-2 py-0.5 rounded">📋</button>
                          </div>
                        </div>
                        <div className="text-display min-h-[80px] max-h-[200px] overflow-y-auto">
                          <p className="text-primary text-sm leading-relaxed font-medium">{videoTranslatedText || 'Kutilmoqda...'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtitles */}
                  {subtitles.length > 0 && (
                    <div className="glass-card rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base-primary text-sm font-semibold">📝 Subtitrlar</h3>
                        <span className="text-base-muted text-xs">{subtitles.length} qism</span>
                      </div>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto text-display">
                        {subtitles.map((sub) => (
                          <div key={sub.id} className="glass rounded-xl px-3 py-2 dict-entry">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-secondary text-[10px] font-mono bg-secondary/10 px-1.5 py-0.5 rounded">
                                {formatTime(sub.startTime)} → {formatTime(sub.endTime)}
                              </span>
                            </div>
                            <p className="text-base-primary text-xs">{sub.originalText}</p>
                            {sub.translatedText && (
                              <p className="text-primary text-xs mt-0.5 font-medium">→ {sub.translatedText}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Done status */}
                  {videoStatus === 'done' && (
                    <div className="text-center animate-fade-in-up">
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-success text-sm font-medium">
                        ✅ Tarjima tayyor!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Loading state */}
              {videoStatus === 'loading' && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin-slow" />
                  <span className="ml-3 text-base-muted text-sm">Video yuklanmoqda...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="py-3 px-4 text-center">
        <p className="text-base-hint text-[10px]">© 2025 Sardor Ovozli Tarjimon — Temurbek Gulboyev tomonidan yaratildi</p>
      </footer>

      {/* ===== HISTORY PANEL ===== */}
      {showHistory && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-50 animate-slide-in-right">
            <div className="h-full glass-strong flex flex-col" style={{ background: darkMode ? 'rgba(10, 10, 26, 0.95)' : 'rgba(240, 244, 255, 0.95)' }}>
              <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                <h3 className="text-base-primary font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tarjima tarixi
                </h3>
                <div className="flex items-center gap-2">
                  {history.length > 0 && <button onClick={clearHistory} className="text-danger text-xs hover:underline">Tozalash</button>}
                  <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-lg glass flex items-center justify-center bg-hover">
                    <svg className="w-4 h-4 text-base-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="text-center text-base-muted py-16">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-sm">Hali tarjima yo'q</p>
                    <p className="text-xs text-base-hint mt-1">Tarjimalar avtomatik saqlanadi</p>
                  </div>
                ) : (
                  history.map(item => (
                    <button key={item.id} onClick={() => loadFromHistory(item)}
                      className="w-full glass-card rounded-xl p-3 text-left bg-hover transition-all group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-base-muted">
                          <span>{getLanguageByCode(item.sourceLang)?.flag}</span>
                          <span>{item.sourceLang.toUpperCase()}</span>
                          <span>→</span>
                          <span>{getLanguageByCode(item.targetLang)?.flag}</span>
                          <span>{item.targetLang.toUpperCase()}</span>
                        </div>
                        <span className="text-[10px] text-base-hint">
                          {new Date(item.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-base-secondary text-xs truncate mb-1">{item.sourceText}</p>
                      <p className="text-primary text-xs truncate group-hover:text-secondary transition-colors">{item.translatedText}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
