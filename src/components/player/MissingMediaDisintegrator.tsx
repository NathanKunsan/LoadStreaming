import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { getDeterministicPalette } from '../../utils/mediaHelpers';

interface MissingMediaDisintegratorProps {
  language: Language;
  item: MediaLibraryItem | null;
  onDisintegrateComplete: (item: MediaLibraryItem) => void;
}

interface DustParticle {
  origX: number;
  origY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
  a: number;
  threshold: number;
  released: boolean;
  angle: number;
  vAngle: number;
  turbulencePhase: number;
}

export const MissingMediaDisintegrator: React.FC<MissingMediaDisintegratorProps> = ({
  language,
  item,
  onDisintegrateComplete
}) => {
  const t = translations[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<'honest-notice' | 'disintegrating'>('honest-notice');
  const loadedThumbRef = useRef<HTMLImageElement | null>(null);

  const CANVAS_W = 440;
  const CANVAS_H = 230;

  // Draw physical cartridge or vinyl sleeve+disc specimen onto a 2D context
  const drawPhysicalSpecimen = (
    ctx: CanvasRenderingContext2D,
    mediaItem: MediaLibraryItem,
    thumb: HTMLImageElement | null,
    withThumbImage: boolean,
    crackProgress = 0
  ) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const [accentA, darkBase, accentB] = getDeterministicPalette(mediaItem.title || mediaItem.id);

    ctx.save();
    if (crackProgress > 0 && crackProgress < 0.35) {
      const shake = Math.sin(crackProgress * 95) * 2.5 * (1 - crackProgress);
      ctx.translate(shake, shake * 0.4);
    }

    if (mediaItem.mediaType === 'video') {
      // Draw realistic physical Video Cartridge shell
      const cx = 85;
      const cy = 36;
      const cw = 270;
      const ch = 158;

      // Outer shadow & casing
      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = '#FAFAFA';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 8);
      ctx.fill();
      ctx.stroke();

      // Top grip ridges
      ctx.fillStyle = '#27272A';
      for (let r = 0; r < 5; r++) {
        ctx.fillRect(cx + 14, cy + 8 + r * 4, cw - 28, 2);
      }

      // Recessed center sticker area
      const lx = cx + 18;
      const ly = cy + 34;
      const lw = cw - 36;
      const lh = 96;

      ctx.fillStyle = darkBase;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 5);
      ctx.fill();

      if (withThumbImage && thumb) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, 5);
        ctx.clip();
        ctx.drawImage(thumb, lx, ly, lw, lh);
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(lx, ly + lh - 30, lw, 30);
        ctx.restore();
      } else {
        const grad = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
        grad.addColorStop(0, accentA);
        grad.addColorStop(1, accentB);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, 5);
        ctx.fill();
      }

      // Sticker border & title bar
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 5);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      const cleanTitle = mediaItem.title.length > 28 ? mediaItem.title.slice(0, 28) + '...' : mediaItem.title;
      ctx.fillText(cleanTitle, lx + 10, ly + lh - 10);

      // Bottom insertion arrow & notches
      ctx.fillStyle = accentA;
      ctx.beginPath();
      ctx.moveTo(cx + cw / 2, cy + ch - 8);
      ctx.lineTo(cx + cw / 2 - 7, cy + ch - 18);
      ctx.lineTo(cx + cw / 2 + 7, cy + ch - 18);
      ctx.closePath();
      ctx.fill();
    } else {
      // Draw Sleeve + Vinyl Picture Disc peeking out
      const sx = 86;
      const sy = 36;
      const size = 154;

      // Vinyl disc protruding right
      const discX = sx + size + 38;
      const discY = sy + size / 2;
      const discR = 72;

      ctx.save();
      ctx.beginPath();
      ctx.arc(discX, discY, discR, 0, Math.PI * 2);
      ctx.fillStyle = '#09090B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#52525B';
      ctx.stroke();

      // Concentric vinyl grooves
      for (let gr = 34; gr < discR - 4; gr += 5) {
        ctx.beginPath();
        ctx.arc(discX, discY, gr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center label
      ctx.beginPath();
      ctx.arc(discX, discY, 26, 0, Math.PI * 2);
      ctx.fillStyle = accentA;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(discX, discY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#18181B';
      ctx.fill();
      ctx.restore();

      // Album Sleeve on left
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx, sy, size, size, 6);
      ctx.fillStyle = darkBase;
      ctx.fill();
      ctx.clip();

      if (withThumbImage && thumb) {
        ctx.drawImage(thumb, sx, sy, size, size);
      } else {
        const grad = ctx.createLinearGradient(sx, sy, sx + size, sy + size);
        grad.addColorStop(0, accentA);
        grad.addColorStop(1, accentB);
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(sx, sy + size - 34, size, 34);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      const cleanTitle = mediaItem.title.length > 20 ? mediaItem.title.slice(0, 20) + '...' : mediaItem.title;
      ctx.fillText(cleanTitle, sx + 8, sy + size - 13);
      ctx.restore();

      ctx.strokeStyle = '#FAFAFA';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx, sy, size, size, 6);
      ctx.stroke();
    }

    // Draw spiderweb fracture cracks during early disintegration
    if (crackProgress > 0) {
      ctx.strokeStyle = `rgba(250, 204, 21, ${Math.min(0.95, crackProgress * 2.5)})`;
      ctx.lineWidth = 1.6;
      const origins = [
        [140, 95],
        [245, 115],
        [195, 145]
      ];
      origins.forEach(([ox, oy], idx) => {
        for (let b = 0; b < 5; b++) {
          const ang = (b / 5) * Math.PI * 2 + idx * 0.7;
          const reach = Math.min(1, crackProgress * 3.2) * (36 + b * 11);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(ang) * reach * 0.5, oy + Math.sin(ang + 0.22) * reach * 0.5);
          ctx.lineTo(ox + Math.cos(ang - 0.15) * reach, oy + Math.sin(ang) * reach);
          ctx.stroke();
        }
      });
    }

    ctx.restore();
  };

  // Render initial specimen when modal opens
  useEffect(() => {
    if (!item) {
      setPhase('honest-notice');
      loadedThumbRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    setPhase('honest-notice');
    loadedThumbRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawPhysicalSpecimen(ctx, item, null, false, 0);
      }
    }

    if (item.thumbnail) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedThumbRef.current = img;
        const c = canvasRef.current;
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) {
            drawPhysicalSpecimen(ctx, item, img, true, 0);
          }
        }
      };
      img.onerror = () => {
        loadedThumbRef.current = null;
      };
      img.src = item.thumbnail;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [item]);

  const triggerDisintegration = () => {
    if (!item || phase === 'disintegrating') return;
    setPhase('disintegrating');
    mechanicalFoley.playDisintegrate();

    const canvas = canvasRef.current;
    if (!canvas) {
      onDisintegrateComplete(item);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onDisintegrateComplete(item);
      return;
    }

    // Offscreen capture of exact specimen pixels (with safe fallback if image tainted CORS)
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_W;
    offscreen.height = CANVAS_H;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) {
      onDisintegrateComplete(item);
      return;
    }

    drawPhysicalSpecimen(offCtx, item, loadedThumbRef.current, true, 0.25);
    let imgData: ImageData;
    try {
      imgData = offCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    } catch {
      const cleanOff = document.createElement('canvas');
      cleanOff.width = CANVAS_W;
      cleanOff.height = CANVAS_H;
      const cleanCtx = cleanOff.getContext('2d')!;
      drawPhysicalSpecimen(cleanCtx, item, null, false, 0.25);
      imgData = cleanCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    }

    // Sample non-transparent pixels into physical dust shards
    const CELL = 3;
    const particles: DustParticle[] = [];
    const data = imgData.data;

    for (let y = 0; y < CANVAS_H; y += CELL) {
      for (let x = 0; x < CANVAS_W; x += CELL) {
        const idx = (y * CANVAS_W + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 32) {
          // Diagonal sweep wavefront from bottom-left toward top-right + organic noise
          const normDiag = (x / CANVAS_W) * 0.72 + ((CANVAS_H - y) / CANVAS_H) * 0.28;
          const jitter = (Math.random() - 0.5) * 0.16;
          particles.push({
            origX: x,
            origY: y,
            x,
            y,
            vx: 38 + Math.random() * 95,
            vy: -24 - Math.random() * 72,
            size: CELL + Math.random() * 1.4,
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: alpha / 255,
            threshold: Math.max(0.08, Math.min(0.92, normDiag * 0.78 + 0.1 + jitter)),
            released: false,
            angle: Math.random() * Math.PI * 2,
            vAngle: (Math.random() - 0.5) * 8,
            turbulencePhase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    const startTime = performance.now();
    let prevTime = startTime;
    const TOTAL_MS = 1950;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / TOTAL_MS);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const wave = progress * 1.18;
      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.released && wave >= p.threshold) {
          p.released = true;
        }

        if (!p.released) {
          aliveCount++;
          // Pre-release fracture tremor near wavefront
          const distToWave = p.threshold - wave;
          let ox = p.origX;
          let oy = p.origY;
          if (distToWave < 0.09) {
            ox += (Math.random() - 0.5) * 2.2;
            oy += (Math.random() - 0.5) * 2.2;
          }
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.a})`;
          ctx.fillRect(ox, oy, CELL, CELL);
        } else {
          // Released dust shard drifting & swirling into thin air
          const curlX = Math.cos(p.y * 0.045 + p.turbulencePhase + progress * 6) * 42;
          const curlY = Math.sin(p.x * 0.04 + p.turbulencePhase + progress * 5) * 34;

          p.x += (p.vx + curlX) * dt;
          p.y += (p.vy + curlY) * dt;
          p.vy -= 18 * dt; // subtle upward thermal draft
          p.vx *= 0.992;
          p.angle += p.vAngle * dt;
          p.a -= dt * (0.78 + (i % 5) * 0.11);
          p.size = Math.max(0.6, p.size - dt * 1.1);

          if (p.a > 0.015) {
            aliveCount++;
            // Gradually desaturate toward fine warm ash as it fades
            const ashMix = Math.min(0.55, 1 - p.a);
            const rr = Math.round(p.r * (1 - ashMix) + 180 * ashMix);
            const gg = Math.round(p.g * (1 - ashMix) + 175 * ashMix);
            const bb = Math.round(p.b * (1 - ashMix) + 168 * ashMix);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = `rgba(${rr},${gg},${bb},${Math.max(0, p.a)})`;
            ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
            ctx.restore();
          }
        }
      }

      if (progress < 1 && aliveCount > 0) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        rafRef.current = null;
        onDisintegrateComplete(item);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="pencil-box w-full max-w-lg bg-[var(--color-surface)] border-2 border-[var(--color-border)] p-5 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        {/* Specimen Disintegration Stage */}
        <div className="relative rounded-xl bg-zinc-950 border-2 border-[var(--color-border)] overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full max-w-[440px] h-auto block"
          />
        </div>

        {phase === 'honest-notice' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/15 border-2 border-red-500/50 text-red-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[var(--color-text-main)]">
                  {t.missingFileTitle}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {t.missingFileHonestBody}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px] space-y-1">
              <div className="font-bold text-[var(--color-text-main)] truncate">
                {item.title}
              </div>
              <div className="text-[var(--color-text-muted)] break-all font-mono text-[10px]">
                <span className="font-semibold">{t.missingFilePathLabel}: </span>
                {item.filePath}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={triggerDisintegration}
                className="px-4 py-2 text-xs font-bold bg-red-500 text-white border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.missingDisintegrateNowBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center space-y-1">
            <p className="text-xs font-bold text-[var(--color-accent)] tracking-wide animate-pulse">
              {t.missingDisintegratingStatus}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              {item.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
