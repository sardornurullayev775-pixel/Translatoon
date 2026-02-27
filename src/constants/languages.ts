/** Language configuration for the Voice Translator */
export interface Language {
  code: string;
  name: string;
  nativeName: string;
  speechCode: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Avtomatik aniqlash', nativeName: 'Auto Detect', speechCode: '', flag: '🌐' },
  { code: 'uz', name: "O'zbek", nativeName: "O'zbekcha", speechCode: 'uz-UZ', flag: '🇺🇿' },
  { code: 'ru', name: 'Rus', nativeName: 'Русский', speechCode: 'ru-RU', flag: '🇷🇺' },
  { code: 'en', name: 'Ingliz', nativeName: 'English', speechCode: 'en-US', flag: '🇺🇸' },
  { code: 'zh', name: 'Xitoy', nativeName: '中文', speechCode: 'zh-CN', flag: '🇨🇳' },
  { code: 'ar', name: 'Arab', nativeName: 'العربية', speechCode: 'ar-SA', flag: '🇸🇦' },
  { code: 'fr', name: 'Fransuz', nativeName: 'Français', speechCode: 'fr-FR', flag: '🇫🇷' },
  { code: 'de', name: 'Nemis', nativeName: 'Deutsch', speechCode: 'de-DE', flag: '🇩🇪' },
  { code: 'es', name: 'Ispan', nativeName: 'Español', speechCode: 'es-ES', flag: '🇪🇸' },
  { code: 'ja', name: 'Yapon', nativeName: '日本語', speechCode: 'ja-JP', flag: '🇯🇵' },
  { code: 'ko', name: 'Koreys', nativeName: '한국어', speechCode: 'ko-KR', flag: '🇰🇷' },
  { code: 'tr', name: 'Turk', nativeName: 'Türkçe', speechCode: 'tr-TR', flag: '🇹🇷' },
  { code: 'fa', name: 'Fors', nativeName: 'فارسی', speechCode: 'fa-IR', flag: '🇮🇷' },
  { code: 'hi', name: 'Hind', nativeName: 'हिन्दी', speechCode: 'hi-IN', flag: '🇮🇳' },
  { code: 'it', name: 'Italyan', nativeName: 'Italiano', speechCode: 'it-IT', flag: '🇮🇹' },
  { code: 'pt', name: 'Portugal', nativeName: 'Português', speechCode: 'pt-PT', flag: '🇵🇹' },
  { code: 'nl', name: 'Niderlandiya', nativeName: 'Nederlands', speechCode: 'nl-NL', flag: '🇳🇱' },
  { code: 'pl', name: 'Polsha', nativeName: 'Polski', speechCode: 'pl-PL', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukraina', nativeName: 'Українська', speechCode: 'uk-UA', flag: '🇺🇦' },
  { code: 'ka', name: 'Gruzin', nativeName: 'ქართული', speechCode: 'ka-GE', flag: '🇬🇪' },
  { code: 'az', name: 'Ozarbayjon', nativeName: 'Azərbaycan', speechCode: 'az-AZ', flag: '🇦🇿' },
];

/** Get a language by code */
export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find(l => l.code === code);
}

/** Get all languages excluding auto detect */
export function getTargetLanguages(): Language[] {
  return LANGUAGES.filter(l => l.code !== 'auto');
}
