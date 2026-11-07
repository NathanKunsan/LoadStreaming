import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  Check,
  X
} from 'lucide-react';
import { translations, Language } from '../../locales/translations';
import { mechanicalFoley } from '../../utils/mechanicalFoley';

interface ImageCropperModalProps {
  language: Language;
  imageSrc: string | null;
  initialAspect?: number;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const STAGE_W = 460;
const STAGE_H = 268;
const PAD_X = 44;
const PAD_Y = 30;

function computeCropRect(aspect: number) {
  const maxW = STAGE_W - PAD_X * 2;
  const maxH = STAGE_H - PAD_Y * 2;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return {
    x: (STAGE_W - w) / 2,
    y: (STAGE_H - h) / 2,
    w,
    h
  };
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  language,
  imageSrc,
  initialAspect = 1.68,
  onApply,
  onCancel
}) => {
  const t = translations[language];

  const [aspect, setAspect] = useState<number>(initialAspect);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0
  });

  // Strict State Cleanup whenever modal opens/closes or imageSrc changes
  useEffect(() => {
    setAspect(initialAspect);
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPan({ x: 0, y: 0 });
    setLoadedImg(null);

    if (!imageSrc) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setLoadedImg(img);
      }
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, initialAspect]);

  const clampPan = useCallback(
    (rawX: number, rawY: number, targetZoom: number, targetRot: number, targetAspect: number) => {
      if (!loadedImg) return { x: 0, y: 0 };
      const rect = computeCropRect(targetAspect);
      const isQuarter = Math.abs(targetRot % 180) === 90;
      const effW = isQuarter ? loadedImg.naturalHeight : loadedImg.naturalWidth;
      const effH = isQuarter ? loadedImg.naturalWidth : loadedImg.naturalHeight;
      const baseScale = Math.max(rect.w / Math.max(1, effW), rect.h / Math.max(1, effH));
      const dispW = effW * baseScale * targetZoom;
      const dispH = effH * baseScale * targetZoom;
      const maxX = Math.max(0, (dispW - rect.w) / 2);
      const maxY = Math.max(0, (dispH - rect.h) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, rawX)),
        y: Math.max(-maxY, Math.min(maxY, rawY))
      };
    },
    [loadedImg]
  );

  // Re-clamp pan whenever zoom, rotation, or aspect changes
  useEffect(() => {
    setPan((prev) => clampPan(prev.x, prev.y, zoom, rotation, aspect));
  }, [zoom, rotation, aspect, clampPan]);

  // Draw live international-standard crop workspace (dimmed outer region + bright clipped crop box + Rule-of-Thirds grid + corner brackets)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = STAGE_W * dpr;
    canvas.height = STAGE_H * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Checkerboard / dark studio backdrop
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    const rect = computeCropRect(aspect);

    const drawTransformedImage = () => {
      if (!loadedImg) return;
      const isQuarter = Math.abs(rotation % 180) === 90;
      const effW = isQuarter ? loadedImg.naturalHeight : loadedImg.naturalWidth;
      const effH = isQuarter ? loadedImg.naturalWidth : loadedImg.naturalHeight;
      const baseScale = Math.max(rect.w / Math.max(1, effW), rect.h / Math.max(1, effH));
      const s = baseScale * zoom;

      ctx.save();
      ctx.translate(STAGE_W / 2 + pan.x, STAGE_H / 2 + pan.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -s : s, flipV ? -s : s);
      ctx.drawImage(
        loadedImg,
        -loadedImg.naturalWidth / 2,
        -loadedImg.naturalHeight / 2,
        loadedImg.naturalWidth,
        loadedImg.naturalHeight
      );
      ctx.restore();
    };

    if (loadedImg) {
      // 1. Draw full image across workspace
      drawTransformedImage();

      // 2. Darken outside crop frame
      ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      // 3. Redraw crisp full-brightness image inside crop frame
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      drawTransformedImage();
      ctx.restore();
    }

    // 4. Rule-of-Thirds 3x3 Alignment Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w / 3, rect.y);
    ctx.lineTo(rect.x + rect.w / 3, rect.y + rect.h);
    ctx.moveTo(rect.x + (rect.w * 2) / 3, rect.y);
    ctx.lineTo(rect.x + (rect.w * 2) / 3, rect.y + rect.h);
    ctx.moveTo(rect.x, rect.y + rect.h / 3);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 3);
    ctx.moveTo(rect.x, rect.y + (rect.h * 2) / 3);
    ctx.lineTo(rect.x + rect.w, rect.y + (rect.h * 2) / 3);
    ctx.stroke();

    // 5. Crisp Crop Frame Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // 6. Corner Precision L-Handles
    const L = 14;
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(rect.x, rect.y + L);
    ctx.lineTo(rect.x, rect.y);
    ctx.lineTo(rect.x + L, rect.y);
    // Top-right
    ctx.moveTo(rect.x + rect.w - L, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + L);
    // Bottom-left
    ctx.moveTo(rect.x, rect.y + rect.h - L);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + L, rect.y + rect.h);
    // Bottom-right
    ctx.moveTo(rect.x + rect.w - L, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - L);
    ctx.stroke();
  }, [loadedImg, aspect, zoom, rotation, flipH, flipV, pan]);

  if (!imageSrc) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const canvas = canvasRef.current;
    const scaleFactor = canvas ? STAGE_W / Math.max(1, canvas.getBoundingClientRect().width) : 1;
    const dx = (e.clientX - dragRef.current.lastX) * scaleFactor;
    const dy = (e.clientY - dragRef.current.lastY) * scaleFactor;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setPan((prev) => clampPan(prev.x + dx, prev.y + dy, zoom, rotation, aspect));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      dragRef.current.active = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoom((prev) => Math.max(1, Math.min(4, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    mechanicalFoley.playClickWheelButton();
    setAspect(initialAspect);
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPan({ x: 0, y: 0 });
  };

  const handleConfirmCrop = () => {
    if (!loadedImg) return;
    mechanicalFoley.playClickWheelButton();

    const rect = computeCropRect(aspect);
    const outW = 680;
    const outH = Math.max(120, Math.round(outW / aspect));
    const exportRatio = outW / rect.w;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const isQuarter = Math.abs(rotation % 180) === 90;
    const effW = isQuarter ? loadedImg.naturalHeight : loadedImg.naturalWidth;
    const effH = isQuarter ? loadedImg.naturalWidth : loadedImg.naturalHeight;
    const baseScale = Math.max(rect.w / Math.max(1, effW), rect.h / Math.max(1, effH));
    const s = baseScale * zoom * exportRatio;

    ctx.translate(outW / 2 + pan.x * exportRatio, outH / 2 + pan.y * exportRatio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -s : s, flipV ? -s : s);
    ctx.drawImage(
      loadedImg,
      -loadedImg.naturalWidth / 2,
      -loadedImg.naturalHeight / 2,
      loadedImg.naturalWidth,
      loadedImg.naturalHeight
    );

    const croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.91);
    onApply(croppedDataUrl);
  };

  const ratioPresets = [
    { label: t.cropRatioTape, value: 1.68 },
    { label: t.cropRatioWide, value: 16 / 9 },
    { label: t.cropRatioStandard, value: 4 / 3 },
    { label: t.cropRatioSquare, value: 1 }
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="pencil-box w-full max-w-lg bg-[var(--color-surface)] border-2 border-[var(--color-border)] p-4 space-y-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
          <h3 className="text-sm font-extrabold text-[var(--color-text-main)]">
            {t.cropModalTitle}
          </h3>
          <button
            type="button"
            onClick={() => {
              mechanicalFoley.playClickWheelButton();
              onCancel();
            }}
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect Ratio Standard Presets */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
            {t.cropRatioLabel}:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {ratioPresets.map((preset) => {
              const active = Math.abs(aspect - preset.value) < 0.02;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    mechanicalFoley.playClickWheelTick();
                    setAspect(preset.value);
                  }}
                  className={`px-2.5 py-1 text-[10px] font-extrabold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
                    active
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-main)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Canvas Crop Stage */}
        <div className="rounded-xl overflow-hidden border-2 border-black bg-zinc-950 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: '100%', maxWidth: `${STAGE_W}px`, aspectRatio: `${STAGE_W} / ${STAGE_H}` }}
            className="cursor-move touch-none block"
          />
        </div>

        <p className="text-[10px] text-[var(--color-text-muted)] text-center">
          {t.cropDragHint}
        </p>

        {/* Zoom Slider + Transform Toolbar (Rotate 90, Flip H/V, Reset) */}
        <div className="space-y-2.5 bg-[var(--color-bg)] p-2.5 rounded-xl border border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <ZoomOut className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <ZoomIn className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="text-[11px] font-mono font-bold text-[var(--color-text-main)] w-11 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelTick();
                  setRotation((r) => (r - 90 + 360) % 360);
                }}
                className="px-2.5 py-1.5 text-[10px] font-bold bg-[var(--color-surface)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                title={t.cropRotateLeft}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.cropRotateLeft}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelTick();
                  setRotation((r) => (r + 90) % 360);
                }}
                className="px-2.5 py-1.5 text-[10px] font-bold bg-[var(--color-surface)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                title={t.cropRotateRight}
              >
                <RotateCw className="w-3 h-3" />
                <span>{t.cropRotateRight}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelTick();
                  setFlipH((f) => !f);
                }}
                className={`px-2.5 py-1.5 text-[10px] font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer ${
                  flipH
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-main)]'
                }`}
                title={t.cropFlipH}
              >
                <FlipHorizontal className="w-3 h-3" />
                <span>{t.cropFlipH}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelTick();
                  setFlipV((f) => !f);
                }}
                className={`px-2.5 py-1.5 text-[10px] font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer ${
                  flipV
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-main)]'
                }`}
                title={t.cropFlipV}
              >
                <FlipVertical className="w-3 h-3" />
                <span>{t.cropFlipV}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 text-[10px] font-bold bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCcw className="w-3 h-3" />
              <span>{t.cropResetBtn}</span>
            </button>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              mechanicalFoley.playClickWheelButton();
              onCancel();
            }}
            className="px-4 py-2 text-xs font-bold bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            {t.cancelModalBtn}
          </button>

          <button
            type="button"
            disabled={!loadedImg}
            onClick={handleConfirmCrop}
            className="px-4 py-2 text-xs font-extrabold bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40 border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.cropApplyBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
