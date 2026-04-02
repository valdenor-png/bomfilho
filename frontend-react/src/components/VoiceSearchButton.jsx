import { useState, useRef, useCallback, useEffect } from 'react';
import { colors } from '../theme';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export default function VoiceSearchButton({ onResult, size = 20 }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const stop = useCallback(() => {
    setListening(false);
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    setError('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.trim();
      if (last.isFinal && transcript) {
        onResult(transcript);
        stop();
      }
    };

    recognition.onerror = (event) => {
      stop();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Permita o microfone pra usar busca por voz');
      } else if (event.error === 'no-speech') {
        setError('Nao entendi, tente novamente');
      } else if (event.error !== 'aborted') {
        setError('Nao entendi, tente novamente');
      }
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      timeoutRef.current = setTimeout(() => {
        stop();
        setError('Nao entendi, tente novamente');
      }, 5000);
    } catch {
      setError('Busca por voz indisponivel');
    }
  }, [onResult, stop]);

  useEffect(() => {
    if (error) {
      const id = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(id);
    }
  }, [error]);

  if (!SpeechRecognition) return null;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={listening ? stop : start}
        aria-label={listening ? 'Parar gravacao' : 'Buscar por voz'}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
          animation: listening ? 'voicePulse 1s ease-in-out infinite' : 'none',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
          stroke={listening ? '#EF4444' : 'rgba(255,255,255,0.5)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      {error && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: colors.card || '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap',
          fontSize: 11, color: 'rgba(255,255,255,0.7)', zIndex: 50,
        }}>
          {error}
        </div>
      )}
      <style>{`
        @keyframes voicePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
