import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { getAdminVoiceIntroSignedUrl } from '@/services/admin';

const SIGNED_TTL = 3600;

/** Lightweight peak preview bars from remote audio (admin moderation). */
function WavePreview({ audioBuffer }: { audioBuffer: AudioBuffer | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.clientWidth || 280;
    const h = 44;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const raw = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(raw.length / 64));
    const bars = 48;
    ctx.fillStyle = 'hsl(var(--primary) / 0.45)';
    for (let i = 0; i < bars; i++) {
      const start = Math.min((i * raw.length) / bars, raw.length - 1);
      let peak = 0;
      for (let j = 0; j < step && start + j < raw.length; j++) {
        peak = Math.max(peak, Math.abs(raw[Math.floor(start) + j] || 0));
      }
      const bh = Math.max(2, peak * h * 0.92);
      const bx = (i / bars) * w;
      const bw = w / bars - 1;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(bx, h - bh, bw, bh, 2);
        ctx.fill();
      } else {
        ctx.fillRect(bx, h - bh, bw, bh);
      }
    }
  }, [audioBuffer]);

  return (
    <canvas ref={canvasRef} className="mt-2 h-11 w-full rounded-lg bg-muted/40" width={400} height={44} />
  );
}

export function VoiceIntroReviewPlayer({
  objectPath,
  durationSeconds,
  userId,
  lazy = false,
  isActive = true,
  onRequestPlay,
  hideDownload = false,
  compact = false,
}: {
  objectPath: string | null;
  durationSeconds: number | null;
  userId?: string;
  lazy?: boolean;
  isActive?: boolean;
  onRequestPlay?: () => void;
  hideDownload?: boolean;
  /** List-row mode: play/pause only, skip waveform decode. */
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(!lazy);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const signedUrlRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);

  const hasSource = userId || objectPath?.trim();

  const load = useCallback(async () => {
    if (!hasSource) {
      setLoading(false);
      setError('אין קובץ');
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (userId) {
        const res = await getAdminVoiceIntroSignedUrl(userId);
        url = res.signedUrl;
      } else {
        const { data, error: signErr } = await supabase.storage
          .from('voice-intros')
          .createSignedUrl(objectPath!, SIGNED_TTL);
        if (signErr || !data?.signedUrl) throw signErr ?? new Error('sign_failed');
        url = data.signedUrl;
      }

      if (ac.signal.aborted) return;

      setSignedUrl(url);
      signedUrlRef.current = url;

      // Compact/list mode: signed URL is enough — do not fetch+decode the full file upfront.
      if (!compact) {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error('fetch_failed');
        const arr = await res.arrayBuffer();
        if (ac.signal.aborted) return;

        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const audioCtx = new Ctx();
          const buf = await audioCtx.decodeAudioData(arr.slice(0));
          if (!ac.signal.aborted) setAudioBuffer(buf);
          await audioCtx.close().catch(() => undefined);
        }
      }
      if (!ac.signal.aborted) setLoaded(true);
    } catch (e) {
      if (ac.signal.aborted) return;
      console.error('[VoiceIntroReviewPlayer]', e);
      setError('לא ניתן לטעון את ההקלטה');
    }
    if (!ac.signal.aborted) setLoading(false);
  }, [hasSource, userId, objectPath, compact]);

  useEffect(() => {
    if (!lazy) void load();
  }, [lazy, load]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const t = () => setCurrentTime(el.currentTime);
    const end = () => setPlaying(false);
    el.addEventListener('timeupdate', t);
    el.addEventListener('ended', end);
    return () => {
      el.removeEventListener('timeupdate', t);
      el.removeEventListener('ended', end);
    };
  }, [signedUrl]);

  useEffect(() => {
    if (!isActive) {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      setPlaying(false);
      setCurrentTime(0);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = '';
      }
      setSignedUrl(null);
      signedUrlRef.current = null;
    };
  }, []);

  const fmt = (s: number) => {
    const x = Math.max(0, Math.floor(s));
    const m = Math.floor(x / 60);
    const r = x % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const totalDur =
    durationSeconds && durationSeconds > 0
      ? durationSeconds
      : audioBuffer?.duration && Number.isFinite(audioBuffer.duration)
        ? audioBuffer.duration
        : 0;

  const startPlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return false;
    onRequestPlay?.();
    void el.play().catch(() => setPlaying(false));
    setPlaying(true);
    return true;
  }, [onRequestPlay]);

  useEffect(() => {
    if (!pendingPlayRef.current || !loaded || !signedUrl) return;
    if (startPlay()) pendingPlayRef.current = false;
  }, [loaded, signedUrl, startPlay]);

  const toggle = async () => {
    if (playing) {
      const el = audioRef.current;
      if (el) {
        el.pause();
        setPlaying(false);
      }
      return;
    }
    if (!loaded && lazy) {
      pendingPlayRef.current = true;
      onRequestPlay?.();
      await load();
      if (!signedUrlRef.current) {
        pendingPlayRef.current = false;
        return;
      }
      // Audio element mounts on next paint; effect above starts playback.
      return;
    }
    if (error || !signedUrlRef.current) return;
    startPlay();
  };

  const handleDownload = async () => {
    if (!signedUrl || !objectPath) return;
    try {
      const res = await fetch(signedUrl);
      const blob = await res.blob();
      const name = objectPath.split('/').pop() || 'voice-intro';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[VoiceIntroReviewPlayer] download', e);
    }
  };

  if (lazy && !loaded && !loading) {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        className={
          compact
            ? 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary'
            : 'inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10'
        }
        aria-label="השמע הקלטה"
      >
        <Play className="h-3.5 w-3.5 ms-0.5" />
        {!compact && 'השמע הקלטה'}
      </button>
    );
  }

  if (loading) {
    return (
      <div
        className={
          compact
            ? 'flex h-9 w-9 items-center justify-center'
            : 'flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground'
        }
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {!compact && 'טוען הקלטה…'}
      </div>
    );
  }

  if (error || !signedUrl) {
    return compact ? null : <p className="text-xs text-muted-foreground">{error || 'אין נתוני הקלטה'}</p>;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <audio ref={audioRef} src={signedUrl} preload="metadata" className="hidden" />
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => void toggle()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playing ? 'עצור' : 'נגן'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ms-0.5" />}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-right">
      <WavePreview audioBuffer={audioBuffer} />
      <audio ref={audioRef} src={signedUrl} preload="metadata" className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => void toggle()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playing ? 'עצור' : 'נגן'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ms-0.5" />}
        </motion.button>
        <p className="flex-1 font-mono text-xs text-muted-foreground">
          {fmt(currentTime)} / {totalDur > 0 ? fmt(totalDur) : durationSeconds ? fmt(durationSeconds) : '—'}
        </p>
        {!hideDownload && objectPath && (
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
          >
            <Download className="h-3.5 w-3.5" />
            הורדה
          </button>
        )}
      </div>
    </div>
  );
}
