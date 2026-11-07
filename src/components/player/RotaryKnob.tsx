import React, { useRef } from 'react';
import { mechanicalFoley } from '../../utils/mechanicalFoley';

interface RotaryKnobProps {
  value: number; // 0 to 1
  onChange: (next: number) => void;
  label: string;
  size?: number;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  onChange,
  label,
  size = 48
}) => {
  const dragStartYRef = useRef<number | null>(null);
  const dragStartValRef = useRef<number>(value);
  const lastDetentStepRef = useRef<number>(Math.round(value * 20));

  const clamped = Math.max(0, Math.min(1, value));
  // -135deg to +135deg
  const angleDeg = -135 + clamped * 270;

  const emitWithDetent = (nextVal: number) => {
    const c = Math.max(0, Math.min(1, nextVal));
    const step = Math.round(c * 20);
    if (step !== lastDetentStepRef.current) {
      lastDetentStepRef.current = step;
      mechanicalFoley.playKnobDetent(0.88 + c * 0.28);
    }
    onChange(c);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    dragStartValRef.current = clamped;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = dragStartYRef.current - e.clientY;
    const nextVal = dragStartValRef.current + dy / 110;
    emitWithDetent(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      dragStartYRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    emitWithDetent(clamped + delta);
  };

  return (
    <div className="flex flex-col items-center select-none gap-1">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{ width: size, height: size }}
        className="relative rounded-full cursor-ns-resize flex items-center justify-center bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-950 border-2 border-zinc-950 shadow-[0_3px_6px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.22)]"
        title={`${label}: ${Math.round(clamped * 100)}%`}
      >
        {/* Outer knurled metallic cap */}
        <div
          style={{
            width: size - 10,
            height: size - 10,
            transform: `rotate(${angleDeg}deg)`
          }}
          className="rounded-full bg-gradient-to-br from-zinc-600 via-zinc-800 to-zinc-900 border border-zinc-500/40 relative flex items-start justify-center pt-1 shadow-inner"
        >
          {/* Luminous position indicator notch */}
          <span className="w-1 h-2.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.85)] block" />
        </div>
      </div>
      <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
        {label} {Math.round(clamped * 100)}%
      </span>
    </div>
  );
};
