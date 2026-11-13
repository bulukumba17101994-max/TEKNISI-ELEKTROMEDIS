import React, { useEffect, useRef, useState } from 'react';
import { Activity, Heart, Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';

interface EkgMonitorProps {
  bpm?: number;
  className?: string;
  showControls?: boolean;
}

export const EkgMonitor: React.FC<EkgMonitorProps> = ({ bpm = 75, className = '', showControls = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [liveBpm, setLiveBpm] = useState(bpm);
  const [pulseActive, setPulseActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play subtle medical beep
  const playBeep = () => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch medical tone
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio context may be restricted before user interaction
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let x = 0;
    let lastY = canvas.height / 2;
    let t = 0;

    // Standard P-Q-R-S-T wave generator
    const getEkgPoint = (time: number, height: number): number => {
      const mid = height / 2;
      const cycle = time % 100; // 0 to 100 cycle

      // Baseline with tiny realistic noise
      const noise = (Math.random() - 0.5) * 1.5;

      if (cycle >= 10 && cycle < 18) {
        // P-wave (atrial depolarization)
        const progress = (cycle - 10) / 8;
        return mid - Math.sin(progress * Math.PI) * (height * 0.12) + noise;
      } else if (cycle >= 22 && cycle < 25) {
        // Q-wave (septal depolarization, small dip)
        return mid + height * 0.08 + noise;
      } else if (cycle >= 25 && cycle < 30) {
        // R-wave peak (ventricular depolarization spike)
        const progress = (cycle - 25) / 5;
        const peak = Math.sin(progress * Math.PI) * (height * 0.42);
        return mid - peak + noise;
      } else if (cycle >= 30 && cycle < 34) {
        // S-wave (deep dip)
        const progress = (cycle - 30) / 4;
        return mid + Math.sin(progress * Math.PI) * (height * 0.16) + noise;
      } else if (cycle >= 42 && cycle < 58) {
        // T-wave (ventricular repolarization)
        const progress = (cycle - 42) / 16;
        return mid - Math.sin(progress * Math.PI) * (height * 0.16) + noise;
      }

      return mid + noise;
    };

    // Medical grid renderer
    const drawGrid = (width: number, height: number) => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Fine grid (1mm equivalent)
      ctx.strokeStyle = 'rgba(185, 28, 28, 0.12)';
      ctx.lineWidth = 0.5;

      const gridSize = 12;
      for (let gx = 0; gx < width; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Major grid (5mm equivalent)
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.22)';
      ctx.lineWidth = 1;
      const majorGrid = gridSize * 5;
      for (let gx = 0; gx < width; gx += majorGrid) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += majorGrid) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
    };

    // Resize canvas to match display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawGrid(canvas.width, canvas.height);
        x = 0;
        lastY = canvas.height / 2;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastBeatTrigger = 0;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear small leading cursor zone
      const eraseWidth = 24;
      ctx.save();
      ctx.fillStyle = '#09090b';
      ctx.fillRect(x, 0, eraseWidth, height);

      // Redraw grid lines in erased chunk
      ctx.strokeStyle = 'rgba(185, 28, 28, 0.12)';
      ctx.lineWidth = 0.5;
      const gridSize = 12;
      const startGx = Math.floor(x / gridSize) * gridSize;
      for (let gx = startGx; gx <= x + eraseWidth; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + eraseWidth, gy);
        ctx.stroke();
      }
      ctx.restore();

      // Next EKG point
      const nextY = getEkgPoint(t, height);

      // Trigger pulse when R-wave peaks (around cycle 27)
      if (t % 100 >= 26 && t % 100 <= 28) {
        const now = Date.now();
        if (now - lastBeatTrigger > 600) {
          lastBeatTrigger = now;
          setPulseActive(true);
          playBeep();
          setTimeout(() => setPulseActive(false), 200);
          // slight natural BPM jitter
          setLiveBpm(74 + Math.floor(Math.sin(Date.now() / 3000) * 3));
        }
      }

      // Draw active trace with glowing red phosphor effect
      ctx.beginPath();
      ctx.moveTo(x, lastY);
      const nextX = x + 2.2;
      ctx.lineTo(nextX, nextY);

      // Glow effect
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Crisp core line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glowing scanhead dot
      ctx.beginPath();
      ctx.arc(nextX, nextY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      lastY = nextY;
      x = nextX;

      if (x >= width) {
        x = 0;
      }

      t += 1.3;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isMuted]);

  return (
    <div
      id="ekg-monitor-container"
      className={`relative overflow-hidden rounded-2xl border-2 border-red-900/60 bg-zinc-950 p-4 shadow-2xl shadow-red-950/40 text-white ${className}`}
    >
      {/* Top Electromedical Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-900/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Heart
              className={`h-7 w-7 text-red-600 transition-transform duration-150 ${
                pulseActive ? 'scale-130 fill-red-600 text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]' : 'scale-100 fill-red-900/40'
              }`}
            />
            {pulseActive && (
              <span className="absolute h-8 w-8 animate-ping rounded-full bg-red-500/50" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tracking-wider text-red-400 font-bold uppercase">
                ELEKTROMEDIS LIVE TELEMETRI
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">
              Lead II • Normal Sinus Rhythm (NSR) • Filter 50Hz/35Hz
            </p>
          </div>
        </div>

        {/* Vital Metrics Counters */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">HEART RATE</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-black text-red-500 tracking-tight">{liveBpm}</span>
              <span className="text-[10px] text-red-300 font-bold">BPM</span>
            </div>
          </div>

          <div className="hidden sm:block text-right border-l border-zinc-800 pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">SpO₂ PULSE</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-black text-cyan-400 tracking-tight">99</span>
              <span className="text-[10px] text-cyan-300 font-bold">%</span>
            </div>
          </div>

          <div className="hidden md:block text-right border-l border-zinc-800 pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">NIBP CALIB</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-xl font-bold text-emerald-400 tracking-tight">120/80</span>
              <span className="text-[10px] text-emerald-300 font-semibold">mmHg</span>
            </div>
          </div>

          {showControls && (
            <button
              id="btn-toggle-ekg-sound"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Aktifkan Suara Beep EKG' : 'Bisukan Suara'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                isMuted
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                  : 'border-red-600 bg-red-950/80 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              }`}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 animate-bounce" />}
            </button>
          )}
        </div>
      </div>

      {/* Main EKG Canvas */}
      <div className="relative mt-3 h-28 w-full overflow-hidden rounded-xl border border-red-900/40 bg-[#09090b]">
        <canvas ref={canvasRef} className="h-full w-full block" />

        {/* Overlay Badges */}
        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-2">
          <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-red-400 border border-red-900/50">
            SPEED: 25 mm/s
          </span>
          <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 border border-zinc-800">
            SENSITIVITY: 10 mm/mV
          </span>
        </div>

        <div className="pointer-events-none absolute top-2 right-3 flex items-center gap-1.5 text-zinc-400 font-mono text-[10px]">
          <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          <span className="text-zinc-300 font-semibold">CALIBRATED • IPSRS UPTD RSUD LAMADDUKELLENG</span>
        </div>
      </div>
    </div>
  );
};
