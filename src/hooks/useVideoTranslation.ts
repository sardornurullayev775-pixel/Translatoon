import { useState, useCallback, useRef } from 'react';

export type VideoStatus = 'idle' | 'loading' | 'ready' | 'extracting' | 'translating' | 'done' | 'error';

export interface VideoSubtitle {
  id: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
}

/**
 * Custom hook for video translation
 * Extracts audio from video, uses Speech Recognition to transcribe,
 * then translates the transcription
 */
export function useVideoTranslation() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [subtitles, setSubtitles] = useState<VideoSubtitle[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createRecognition(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;
    return new SpeechRecognitionAPI();
  }

  /** Load a video file */
  const loadVideo = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Faqat video fayllar qo\'llab-quvvatlanadi');
      setStatus('error');
      return;
    }

    // Max 100MB
    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg('Video hajmi 100MB dan katta bo\'lmasligi kerak');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setProgress(0);
    setOriginalText('');
    setTranslatedText('');
    setSubtitles([]);
    setErrorMsg('');
    setVideoName(file.name);

    // Create object URL for video
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setStatus('ready');
  }, []);

  /** Extract and transcribe audio from the video using Web Speech API */
  const extractAndTranscribe = useCallback(async (
    sourceLang: string,
    targetLang: string
  ) => {
    if (!videoRef.current) {
      setErrorMsg('Video element topilmadi');
      setStatus('error');
      return;
    }

    setStatus('extracting');
    setProgress(10);
    setOriginalText('');
    setTranslatedText('');
    setSubtitles([]);

    const video = videoRef.current;

    try {
      // Try to capture audio from video element
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
      
      if (!SpeechRecognitionAPI) {
        setErrorMsg('Brauzeringiz ovoz tanishni qo\'llab-quvvatlamaydi. Chrome ishlatgan ma\'qul.');
        setStatus('error');
        return;
      }

      // We'll play the video and use speech recognition to capture audio from the microphone
      // Note: Web Speech API listens to microphone, so for video we'll use a different approach
      // We'll play the video audio through speakers and capture via mic (simplified approach)
      
      // Alternative: Process video in chunks with recognition
      const recognition = new SpeechRecognitionAPI();
      const langCode = sourceLang === 'auto' ? 'en-US' : 
        (sourceLang === 'uz' ? 'uz-UZ' : 
         sourceLang === 'ru' ? 'ru-RU' :
         sourceLang === 'en' ? 'en-US' :
         sourceLang === 'tr' ? 'tr-TR' :
         sourceLang === 'de' ? 'de-DE' :
         sourceLang === 'fr' ? 'fr-FR' :
         sourceLang === 'es' ? 'es-ES' :
         sourceLang === 'ja' ? 'ja-JP' :
         sourceLang === 'ko' ? 'ko-KR' :
         sourceLang === 'zh' ? 'zh-CN' :
         sourceLang === 'ar' ? 'ar-SA' :
         `${sourceLang}-${sourceLang.toUpperCase()}`);

      recognition.lang = langCode;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognitionRef.current = recognition;
      
      let fullTranscript = '';
      const subs: VideoSubtitle[] = [];
      let segmentStart = 0;
      
      recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            fullTranscript += transcript + ' ';
            const currentTime = video.currentTime;
            subs.push({
              id: `sub-${Date.now()}-${i}`,
              startTime: segmentStart,
              endTime: currentTime,
              originalText: transcript.trim(),
              translatedText: '',
            });
            segmentStart = currentTime;
          } else {
            interim = transcript;
          }
        }
        
        setOriginalText(fullTranscript + (interim ? `[${interim}]` : ''));
        setSubtitles([...subs]);
        setProgress(Math.min(80, 20 + (video.currentTime / video.duration) * 60));
      };

      recognition.onerror = (event: { error: string }) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error('[VideoTranslation] Recognition error:', event.error);
        }
      };

      recognition.onend = () => {
        // Restart if video is still playing
        if (video && !video.paused && !video.ended) {
          try { recognition.start(); } catch { /* */ }
        }
      };

      // Start playback and recognition
      video.currentTime = 0;
      video.volume = 1;
      
      try {
        // Try to capture audio stream from video
        if ('captureStream' in video || 'mozCaptureStream' in video) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
          if (stream) {
            // Create audio context and play through default output
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(audioContext.destination);
          }
        }
      } catch {
        // captureStream might not be available
      }

      await video.play();
      recognition.start();

      // Wait for video to end
      await new Promise<void>((resolve) => {
        video.onended = () => {
          video.onended = null;
          resolve();
        };
        video.onpause = () => {
          // If paused manually, also resolve
        };
      });

      // Stop recognition
      try { recognition.stop(); } catch { /* */ }
      
      setProgress(85);
      
      // Now translate the full transcript
      if (fullTranscript.trim()) {
        setStatus('translating');
        
        const langPair = sourceLang === 'auto' 
          ? `autodetect|${targetLang}` 
          : `${sourceLang}|${targetLang}`;

        try {
          // Translate full text
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(fullTranscript.trim().substring(0, 500))}&langpair=${langPair}`;
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.responseData?.translatedText) {
            setTranslatedText(data.responseData.translatedText);
          }

          // Translate each subtitle
          setProgress(90);
          const translatedSubs = [...subs];
          for (let i = 0; i < Math.min(translatedSubs.length, 20); i++) {
            try {
              const subUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(translatedSubs[i].originalText)}&langpair=${langPair}`;
              const subRes = await fetch(subUrl);
              const subData = await subRes.json();
              if (subData.responseData?.translatedText) {
                translatedSubs[i].translatedText = subData.responseData.translatedText;
              }
              setProgress(90 + (i / translatedSubs.length) * 10);
            } catch {
              translatedSubs[i].translatedText = translatedSubs[i].originalText;
            }
          }
          setSubtitles(translatedSubs);
        } catch {
          setErrorMsg('Tarjima xatosi');
        }
      } else {
        setOriginalText('Videoda ovoz aniqlanmadi. Videoni ovoz chiqarib tinglating.');
      }

      setProgress(100);
      setStatus('done');
    } catch (err) {
      console.error('[VideoTranslation] Error:', err);
      setErrorMsg('Video qayta ishlashda xatolik yuz berdi');
      setStatus('error');
    }
  }, []);

  /** Stop current processing */
  const stopProcessing = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setStatus(videoUrl ? 'ready' : 'idle');
  }, [videoUrl]);

  /** Clear everything */
  const clearVideo = useCallback(() => {
    stopProcessing();
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setVideoName('');
    setStatus('idle');
    setProgress(0);
    setOriginalText('');
    setTranslatedText('');
    setSubtitles([]);
    setErrorMsg('');
  }, [videoUrl, stopProcessing]);

  /** Format time MM:SS */
  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    videoUrl,
    videoName,
    status,
    progress,
    originalText,
    translatedText,
    subtitles,
    errorMsg,
    videoRef,
    loadVideo,
    extractAndTranscribe,
    stopProcessing,
    clearVideo,
    formatTime,
  };
}
