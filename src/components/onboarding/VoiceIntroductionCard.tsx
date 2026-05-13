import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Pause, Trash2, RotateCcw } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  pickRecordingMimeType,
  VOICE_INTRO_MIN_SEC,
  VOICE_INTRO_MAX_SEC,
} from '@/services/voiceIntroRecording';

type Phase = 'idle' | 'recording' | 'recorded' | 'unsupported';

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function VoiceIntroductionCard() {
  const { voiceIntroDraftRef } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const [shortRecordingNote, setShortRecordingNote] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>('');
  const startMsRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const revokePreviewUrl = useCallback((url: string | null) => {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const replacePreviewUrl = useCallback(
    (next: string | null) => {
      if (previewUrlRef.current) revokePreviewUrl(previewUrlRef.current);
      previewUrlRef.current = next;
      setPreviewUrl(next);
    },
    [revokePreviewUrl],
  );

  useEffect(
    () => () => {
      if (previewUrlRef.current) revokePreviewUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    },
    [revokePreviewUrl],
  );

  const cleanupStream = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 40;
    const step = Math.floor(bufferLength / barCount);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
      grad.addColorStop(0.5, 'rgba(192, 132, 252, 0.85)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 0.35)');
      const barW = w / barCount - 2;
      for (let i = 0; i < barCount; i++) {
        let v = 0;
        for (let j = 0; j < step; j++) v += dataArray[i * step + j] || 0;
        v = (v / step / 255) * h * 0.85;
        const x = i * (w / barCount) + 1;
        const y = h - v;
        ctx.fillStyle = grad;
        if (typeof (ctx as CanvasRenderingContext2D).roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, barW, v, 3);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, v);
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
  }, []);

  const startRecording = useCallback(async () => {
    setPermissionNote(null);
    setShortRecordingNote(false);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      console.info('[voiceIntro] recorder_unsupported');
      return;
    }

    try {
      console.info('[voiceIntro] recording_start');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const picked = pickRecordingMimeType();
      mimeRef.current = picked;
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 64000,
      };
      if (picked) options.mimeType = picked;

      const rec = new MediaRecorder(stream, options);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const mime = mimeRef.current || chunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        const elapsed = (Date.now() - startMsRef.current) / 1000;
        cleanupStream();

        console.info('[voiceIntro] recording_stop', { seconds: elapsed, bytes: blob.size });

        if (elapsed < VOICE_INTRO_MIN_SEC) {
          setShortRecordingNote(true);
          setPhase('idle');
          voiceIntroDraftRef.current = null;
          replacePreviewUrl(null);
          return;
        }

        const url = URL.createObjectURL(blob);
        replacePreviewUrl(url);
        voiceIntroDraftRef.current = {
          blob,
          durationSec: Math.min(elapsed, VOICE_INTRO_MAX_SEC),
          mimeType: mime,
        };
        setPhase('recorded');
        setPlaybackTime(0);
      };

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      recorderRef.current = rec;
      rec.start(120);
      startMsRef.current = Date.now();
      setElapsedSec(0);
      setPhase('recording');

      tickRef.current = setInterval(() => {
        setElapsedSec((Date.now() - startMsRef.current) / 1000);
      }, 120);

      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      }, VOICE_INTRO_MAX_SEC * 1000);

      requestAnimationFrame(() => drawWave());
    } catch (e) {
      console.error('[voiceIntro] getUserMedia_failed', e);
      setPermissionNote('יש לאפשר גישה למיקרופון כדי להקליט');
      cleanupStream();
    }
  }, [cleanupStream, drawWave, replacePreviewUrl, voiceIntroDraftRef]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const deleteRecording = useCallback(() => {
    console.info('[voiceIntro] recording_delete');
    replacePreviewUrl(null);
    voiceIntroDraftRef.current = null;
    setPhase('idle');
    setElapsedSec(0);
    setPlaybackTime(0);
    setPlaying(false);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
  }, [replacePreviewUrl, voiceIntroDraftRef]);

  const togglePlay = useCallback(() => {
    const el = audioElRef.current;
    if (!el || !previewUrlRef.current) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }, [playing]);

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onTime = () => setPlaybackTime(el.currentTime);
    const onEnded = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [phase]);

  const durationDisplay =
    phase === 'recorded' && voiceIntroDraftRef.current
      ? voiceIntroDraftRef.current.durationSec
      : elapsedSec;

  if (phase === 'unsupported') {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-border/60 glass-premium p-5 text-center text-sm text-muted-foreground"
      >
        הדפדפן לא תומך בהקלטה ישירות. אפשר להמשיך בלי הקלטה קולית.
      </div>
    );
  }

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-primary/25 p-5 md:p-6"
      style={{
        background:
          'linear-gradient(145deg, hsl(var(--card) / 0.75), hsl(263 40% 18% / 0.35))',
        boxShadow:
          '0 0 0 1px hsl(263 84% 55% / 0.12), 0 18px 48px -12px hsl(263 84% 40% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.06)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 20% 0%, hsl(263 90% 60% / 0.35), transparent 55%)',
        }}
      />

      <div className="relative space-y-4">
        <div className="text-right space-y-1">
          <h3 className="text-[17px] md:text-[19px] font-bold text-foreground leading-snug">
            ספר/י לנו קצת על עצמך בקול 🎙️
          </h3>
          <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed">
            ספר/י מי את/ה, למה תרצה/י להצטרף לקהילה ומה מחפש/ת כאן
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {VOICE_INTRO_MIN_SEC}–{VOICE_INTRO_MAX_SEC} שניות · אופציונלי
          </p>
        </div>

        {permissionNote && (
          <p className="text-sm text-amber-600 dark:text-amber-400 text-right">{permissionNote}</p>
        )}
        {shortRecordingNote && (
          <p className="text-sm text-destructive text-right">
            ההקלטה קצרה מדי — נדרשות לפחות {VOICE_INTRO_MIN_SEC} שניות
          </p>
        )}

        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-2"
            >
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 50%))',
                  boxShadow: '0 8px 32px hsl(263 84% 45% / 0.45)',
                }}
              >
                <Mic className="h-8 w-8 text-white" strokeWidth={1.75} />
              </motion.div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void startRecording()}
                className="rounded-full px-8 py-3 text-base font-semibold text-primary-foreground shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))',
                }}
              >
                התחל הקלטה
              </motion.button>
            </motion.div>
          )}

          {phase === 'recording' && (
            <motion.div
              key="rec"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-3">
                <motion.span
                  className="h-3 w-3 rounded-full bg-destructive"
                  animate={{ scale: [1, 1.35, 1], opacity: [1, 0.75, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="font-mono text-xl tabular-nums text-foreground">
                  {formatClock(Math.min(elapsedSec, VOICE_INTRO_MAX_SEC))}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {formatClock(VOICE_INTRO_MAX_SEC)}
                </span>
              </div>
              <canvas
                ref={canvasRef}
                className="h-16 w-full rounded-xl bg-black/20"
                width={600}
                height={64}
              />
              <div className="flex justify-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={stopRecording}
                  className="flex items-center gap-2 rounded-full bg-destructive px-6 py-2.5 text-sm font-semibold text-destructive-foreground"
                >
                  <Square className="h-4 w-4 fill-current" />
                  עצור
                </motion.button>
              </div>
            </motion.div>
          )}

          {phase === 'recorded' && previewUrl && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <audio
                ref={audioElRef}
                src={previewUrl}
                preload="metadata"
                className="hidden"
                onLoadedMetadata={(e) => {
                  const t = e.currentTarget.duration;
                  if (Number.isFinite(t) && t > 0) setPlaybackTime(0);
                }}
              />
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlay}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground"
                  style={{
                    background: 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))',
                  }}
                  aria-label={playing ? 'השהה' : 'נגן'}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ms-0.5" />}
                </motion.button>
                <div className="min-w-0 flex-1 text-end">
                  <p className="font-mono text-sm tabular-nums text-foreground">
                    {formatClock(playbackTime)} / {formatClock(durationDisplay)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">משך ההקלטה</p>
                </div>
              </div>
              <div className="canvas-placeholder h-10 w-full rounded-lg bg-muted/30 flex items-end justify-center gap-0.5 px-2 pb-1 opacity-70">
                {Array.from({ length: 48 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-sm bg-primary/50"
                    style={{ height: `${12 + (i % 7) * 6}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={deleteRecording}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  מחק
                </button>
                <button
                  type="button"
                  onClick={() => {
                    replacePreviewUrl(null);
                    voiceIntroDraftRef.current = null;
                    setPhase('idle');
                    setPlaying(false);
                    void startRecording();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  הקלט מחדש
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
