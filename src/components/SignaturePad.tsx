import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, RotateCcw, Check, X, ShieldCheck } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  roleTitle: string;
  signerName: string;
  value?: string; // base64 data url
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  roleTitle,
  signerName,
  value,
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [isPadOpen, setIsPadOpen] = useState(false);

  // Redraw when canvas opens or value changes
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set display resolution vs internal canvas size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#1e3a8a'; // Blue ink
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
      setHasSignature(true);
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
      setHasSignature(false);
    }
  }, [value]);

  useEffect(() => {
    if (isPadOpen) {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [isPadOpen, initCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onChange('');
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasSignature) {
      onChange('');
      setIsPadOpen(false);
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
    setIsPadOpen(false);
  };

  const handleRemoveExisting = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setHasSignature(false);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[11px] font-bold text-zinc-300 truncate">{label}</span>
          {value ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              Tertanda
            </span>
          ) : (
            <span className="text-[9px] text-zinc-500 font-mono">Belum TTD</span>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 font-medium truncate">{roleTitle}</p>
        <p className="text-[11px] text-amber-300 font-bold truncate mt-0.5">{signerName || '-'}</p>
      </div>

      {/* Signature Preview Box / Click to Sign */}
      <div className="mt-2">
        {value ? (
          <div className="relative group rounded-lg border border-emerald-900/60 bg-white/95 p-1 flex items-center justify-center h-16 overflow-hidden">
            <img
              src={value}
              alt={`TTD ${label}`}
              className="max-h-full max-w-full object-contain pointer-events-none"
            />
            {!disabled && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsPadOpen(true)}
                  className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-500"
                >
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={handleRemoveExisting}
                  className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-500"
                >
                  Hapus
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsPadOpen(true)}
            className="w-full h-16 rounded-lg border-2 border-dashed border-zinc-700 hover:border-red-500 bg-zinc-950 hover:bg-zinc-900 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <PenTool className="h-4 w-4 text-red-400" />
            <span className="text-[10px] font-bold">Klik untuk Tanda Tangan</span>
          </button>
        )}
      </div>

      {/* Signature Modal / Canvas Drawer */}
      {isPadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <PenTool className="h-4 w-4 text-red-500" />
                  Goreskan Tanda Tangan Digital
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {label} • <span className="text-amber-300 font-bold">{signerName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPadOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawing Canvas Area */}
            <div className="space-y-1.5">
              <div className="relative rounded-xl border-2 border-zinc-600 bg-white shadow-inner overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
                <div className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-dashed border-zinc-300 flex justify-between text-[9px] text-zinc-400">
                  <span>Area Tanda Tangan Digital (BAP Alkes UPTD RSUD LAMADDUKELLENG)</span>
                  <span>Tinta Biru Resmi</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 italic text-center">
                Gunakan jari (layar sentuh / HP) atau kursor mouse untuk menandatangani.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Ulangi / Bersihkan</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPadOpen(false)}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-red-500 hover:to-red-600 active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  <span>Gunakan TTD Ini</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
