import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

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
}: {
  objectPath: string | null;
  durationSeconds: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    if (!objectPath?.trim()) {
      setLoading(false);
      setError('אין קובץ');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: signErr } = await supabase.storage
        .from('voice-intros')
        .createSignedUrl(objectPath, SIGNED_TTL);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error('sign_failed');

      setSignedUrl(data.signedUrl);

      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error('fetch_failed');
      const arr = await res.arrayBuffer();
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ac = new Ctx();
        const buf = await ac.decodeAudioData(arr.slice(0));
        setAudioBuffer(buf);
        await ac.close().catch(() => undefined);
      }
    } catch (e) {
      console.error('[VoiceIntroReviewPlayer]', e);
      setError('לא ניתן לטעון את ההקלטה');
    }
    setLoading(false);
  }, [objectPath]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען הקלטה…
      </div>
    );
  }

  if (error || !signedUrl) {
    return <p className="text-xs text-muted-foreground">{error || 'אין נתוני הקלטה'}</p>;
  }

  return (
    <div className="space-y-2 text-right">
      <WavePreview audioBuffer={audioBuffer} />
      <audio ref={audioRef} src={signedUrl} preload="metadata" className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={toggle}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playing ? 'השהה' : 'נגן'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ms-0.5" />}
        </motion.button>
        <p className="flex-1 font-mono text-xs text-muted-foreground">
          {fmt(currentTime)} / {totalDur > 0 ? fmt(totalDur) : durationSeconds ? fmt(durationSeconds) : '—'}
        </p>
        <button
          type="button"
          onClick={() => void handleDownload()}
          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
        >
          <Download className="h-3.5 w-3.5" />
          הורדה
        </button>
      </div>
    </div>
  );
}
