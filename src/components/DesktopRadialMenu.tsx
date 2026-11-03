import React, { useState, useEffect, useRef } from 'react';
import { Video, Music, Folder, Repeat, X, AppWindow } from 'lucide-react';
import { Language } from '../locales/translations';
import { AppConfig } from '../../electron/types';

interface DesktopRadialMenuProps {
  initialConfig?: AppConfig;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegrees: number) {
  const rad = (angleDegrees * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngle: number,
  endAngle: number
): string {
  const p1 = polarToCartesian(cx, cy, rOut, startAngle);
  const p2 = polarToCartesian(cx, cy, rOut, endAngle);
  const p3 = polarToCartesian(cx, cy, rIn, endAngle);
  const p4 = polarToCartesian(cx, cy, rIn, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z'
  ].join(' ');
}

type SliceDirection = 'north' | 'east' | 'south' | 'west';

export const DesktopRadialMenu: React.FC<DesktopRadialMenuProps> = () => {
  const [config, setConfig] = useState<AppConfig>({
    theme: 'yellow-black',
    language: 'th',
    outputDir: ''
  });

  const [activeSlice, setActiveSlice] = useState<SliceDirection | null>(null);
  const [mouseAngle, setMouseAngle] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasExecutedRef = useRef(false);

  const cx = 180;
  const cy = 180;
  const rOut = 165;
  const rIn = 60;
  const gap = 2.5; // degrees

  const language: Language = config.language || 'th';

  // Listen to radial open trigger with updated config
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      const unsub = window.electronAPI.onOpenRadial?.((data) => {
        hasExecutedRef.current = false;
        if (data && data.config) {
          setConfig(data.config);
        }
        setActiveSlice(null);
        setMouseAngle(null);
      });

      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  const actionNorth = config.radialActions?.north || 'actDownloadVideo';
  const actionEast = config.radialActions?.east || 'actDownloadAudio';
  const actionSouth = config.radialActions?.south || 'actOpenFolder';
  const actionWest = config.radialActions?.west || 'actOpenConvert';

  const getActionInfo = (actKey: string) => {
    switch (actKey) {
      case 'actDownloadVideo':
        return { label: language === 'th' ? 'โหลดวิดีโอ' : 'Download Video', icon: Video };
      case 'actDownloadAudio':
        return { label: language === 'th' ? 'โหลด MP3' : 'Download MP3', icon: Music };
      case 'actOpenFolder':
        return { label: language === 'th' ? 'เปิดโฟลเดอร์' : 'Open Folder', icon: Folder };
      case 'actOpenConvert':
        return { label: language === 'th' ? 'แปลงไฟล์' : 'Converter', icon: Repeat };
      case 'actToggleApp':
        return { label: language === 'th' ? 'เปิด/ปิดจอ' : 'Toggle App', icon: AppWindow };
      default:
        return { label: actKey, icon: Video };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= 35) {
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
      setMouseAngle(deg);
      if (deg >= -135 && deg < -45) {
        setActiveSlice('north');
      } else if (deg >= -45 && deg < 45) {
        setActiveSlice('east');
      } else if (deg >= 45 && deg < 135) {
        setActiveSlice('south');
      } else {
        setActiveSlice('west');
      }
    } else {
      setActiveSlice(null);
      setMouseAngle(null);
    }
  };

  const handleExecute = (direction: SliceDirection) => {
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    let act = actionNorth;
    if (direction === 'east') act = actionEast;
    if (direction === 'south') act = actionSouth;
    if (direction === 'west') act = actionWest;

    if (window.electronAPI) {
      window.electronAPI.executeRadialAction(act);
    }
  };

  const handleClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlice) {
      handleExecute(activeSlice);
    } else {
      if (window.electronAPI) {
        window.electronAPI.closeRadialMenu();
      }
    }
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlice) {
      handleExecute(activeSlice);
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.electronAPI) {
      window.electronAPI.closeRadialMenu();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === '1' || e.key === 'ArrowUp') {
        handleExecute('north');
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        handleExecute('east');
      } else if (e.key === '3' || e.key === 'ArrowDown') {
        handleExecute('south');
      } else if (e.key === '4' || e.key === 'ArrowLeft') {
        handleExecute('west');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (activeSlice) {
          handleExecute(activeSlice);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlice, actionNorth, actionEast, actionSouth, actionWest]);

  // Slices Definition
  const slices = [
    {
      dir: 'north' as SliceDirection,
      start: -135 + gap,
      end: -45 - gap,
      action: actionNorth,
      info: getActionInfo(actionNorth),
      iconPos: polarToCartesian(cx, cy, 115, -90)
    },
    {
      dir: 'east' as SliceDirection,
      start: -45 + gap,
      end: 45 - gap,
      action: actionEast,
      info: getActionInfo(actionEast),
      iconPos: polarToCartesian(cx, cy, 115, 0)
    },
    {
      dir: 'south' as SliceDirection,
      start: 45 + gap,
      end: 135 - gap,
      action: actionSouth,
      info: getActionInfo(actionSouth),
      iconPos: polarToCartesian(cx, cy, 115, 90)
    },
    {
      dir: 'west' as SliceDirection,
      start: 135 + gap,
      end: 225 - gap,
      action: actionWest,
      info: getActionInfo(actionWest),
      iconPos: polarToCartesian(cx, cy, 115, 180)
    }
  ];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      className={`theme-${config.theme} w-[360px] h-[360px] select-none flex items-center justify-center relative cursor-pointer overflow-hidden bg-transparent`}
    >
      <svg
        width="360"
        height="360"
        viewBox="0 0 360 360"
        className="w-full h-full filter drop-shadow-2xl"
      >
        {/* Background Ambient Glow Ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rOut + 2}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          opacity="0.3"
        />

        {/* 4 True Circular Donut Slices */}
        {slices.map((slice) => {
          const isActive = activeSlice === slice.dir;
          const pathD = describeDonutSlice(cx, cy, rIn, rOut, slice.start, slice.end);

          return (
            <path
              key={slice.dir}
              d={pathD}
              fill={isActive ? 'var(--color-accent)' : 'var(--color-surface)'}
              stroke="var(--color-border)"
              strokeWidth={isActive ? '3' : '2'}
              className="transition-all duration-150 ease-out cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleExecute(slice.dir);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                handleExecute(slice.dir);
              }}
              style={{
                filter: isActive ? 'drop-shadow(0 0 8px var(--color-accent))' : undefined
              }}
            />
          );
        })}

        {/* Center Hub Circle (Inner Hole Dead Zone) */}
        <circle
          cx={cx}
          cy={cy}
          r={rIn - 6}
          fill="var(--color-bg)"
          stroke="var(--color-border)"
          strokeWidth="2.5"
          className="transition-colors hover:stroke-[var(--color-accent)] cursor-pointer"
          onClick={handleClose}
        />

        {/* Continuous Directional Indicator Bead on Rim (Smooth 360 Rotation) */}
        {mouseAngle !== null && activeSlice && (
          <circle
            cx={cx + (rIn - 6) * Math.cos((mouseAngle * Math.PI) / 180)}
            cy={cy + (rIn - 6) * Math.sin((mouseAngle * Math.PI) / 180)}
            r="4.5"
            fill="var(--color-accent)"
            stroke="#000000"
            strokeWidth="1.5"
            className="pointer-events-none"
            style={{
              filter: 'drop-shadow(0 0 6px var(--color-accent))'
            }}
          />
        )}
      </svg>

      {/* Center Hub Content: ESC / Close Vector */}
      <div
        onClick={handleClose}
        className="absolute w-20 h-20 rounded-full flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer z-20 pointer-events-auto"
        title="ESC: ปิดวงล้อ"
      >
        <X className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] font-bold font-mono tracking-wider">ESC</span>
      </div>

      {/* Slices Content (Icons & Labels positioned at quadrant centers) */}
      {slices.map((slice) => {
        const isActive = activeSlice === slice.dir;
        const IconComponent = slice.info.icon;
        const { x, y } = slice.iconPos;

        return (
          <div
            key={slice.dir}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            className={`absolute flex flex-col items-center justify-center text-center pointer-events-none transition-transform duration-150 z-10 ${
              isActive
                ? 'text-black scale-105 font-black'
                : 'text-[var(--color-text-main)] font-bold'
            }`}
          >
            <IconComponent
              className={`w-6 h-6 mb-1 ${
                isActive ? 'text-black stroke-[2.5]' : 'text-[var(--color-accent)]'
              }`}
            />
            <span className="text-[11px] leading-tight whitespace-nowrap">
              {slice.info.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
