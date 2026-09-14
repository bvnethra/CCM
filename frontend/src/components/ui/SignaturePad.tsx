import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, PenTool, Check } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  readOnly?: boolean;
  initialDataUrl?: string | null;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  width = 500,
  height = 180,
  readOnly = false,
  initialDataUrl = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && onSignatureChange) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (onSignatureChange) {
      onSignatureChange(null);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 overflow-hidden shadow-inner hover:border-slate-400 transition-colors">
        {!hasSignature && !readOnly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
            <PenTool className="h-6 w-6 mb-1 opacity-50" />
            <span className="text-xs font-medium">Draw signature inside this box</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`touch-none cursor-crosshair ${readOnly ? 'pointer-events-none' : ''}`}
        />
        {hasSignature && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
            <Check className="h-3 w-3" /> Captured
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between w-full max-w-[500px] mt-2">
          <button
            type="button"
            onClick={clearCanvas}
            disabled={!hasSignature}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear & Re-sign
          </button>
          <span className="text-[11px] text-slate-400">Use mouse cursor or touch screen</span>
        </div>
      )}
    </div>
  );
};
