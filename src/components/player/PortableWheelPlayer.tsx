import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronRight,
  Repeat,
  Volume2,
  Search
} from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck, RepeatMode } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime } from '../../utils/mediaHelpers';
import { MediaThumb } from './MediaThumb';

interface PortableWheelPlayerProps {
  language: Language;
}

type LcdScreenId = 'root' | 'songs' | 'mixtapes' | 'mixtapeTracks' | 'nowPlaying';

interface CordNode {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
}

function buildSmoothSvgPath(pts: CordNode[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1);
    const yc = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1);
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${xc} ${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export const PortableWheelPlayer: React.FC<PortableWheelPlayerProps> = ({ language }) => {
  const t = translations[language];
  const {
    audioItems,
    mixtapes,
    activeMachine,
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    loadAndPlayQueue,
    playAudio,
    pauseAudio,
    seekAudio,
    nextTrack,
    prevTrack,
    setVolume,
    setRepeatMode
  } = useAudioDeck();

  const isPortableActive = activeMachine === 'portable' && Boolean(currentTrack);

  const [screenStack, setScreenStack] = useState<LcdScreenId[]>(() =>
    isPortableActive ? ['root', 'nowPlaying'] : ['root']
  );
  const [cursorByScreen, setCursorByScreen] = useState<Record<string, number>>({
    root: 0,
    songs: 0,
    mixtapes: 0,
    mixtapeTracks: 0
  });
  const [openedMixtapeIdx, setOpenedMixtapeIdx] = useState<number>(0);
  const [nowPlayingMode, setNowPlayingMode] = useState<'volume' | 'scrub'>('volume');
  const [companionSearch, setCompanionSearch] = useState<string>('');

  // Headphone Plug-In State ('unplugged' | 'plugging' | 'plugged')
  const [plugState, setPlugState] = useState<'unplugged' | 'plugging' | 'plugged'>(() =>
    isPortableActive ? 'plugged' : 'unplugged'
  );
  const prevPortableActiveRef = useRef<boolean>(isPortableActive);

  // Refs for Click Wheel
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const isDraggingWheelRef = useRef<boolean>(false);
  const lastWheelAngleRef = useRef<number | null>(null);
  const accumAngleRef = useRef<number>(0);
  const activeListRowRef = useRef<HTMLDivElement | null>(null);

  // Refs for Interactive Verlet Physics Headphone Cord
  const stageRef = useRef<HTMLDivElement | null>(null);
  const jackAnchorRef = useRef<HTMLDivElement | null>(null);
  const cordShadowPathRef = useRef<SVGPathElement | null>(null);
  const cordBorderPathRef = useRef<SVGPathElement | null>(null);
  const cordCorePathRef = useRef<SVGPathElement | null>(null);
  const cordSheenPathRef = useRef<SVGPathElement | null>(null);
  const cordHitPathRef = useRef<SVGPathElement | null>(null);
  const splitterGroupRef = useRef<SVGGElement | null>(null);

  const cordNodesRef = useRef<CordNode[]>([]);
  const cordGrabRef = useRef<{
    active: boolean;
    nodeIdx: number;
    pointerX: number;
    pointerY: number;
    maxStretch: number;
  }>({
    active: false,
    nodeIdx: 7,
    pointerX: 0,
    pointerY: 0,
    maxStretch: 0
  });

  const currentScreen = screenStack[screenStack.length - 1];

  // Trigger 3.5mm Headphone Plug-In Animation when a song starts playing on Pocket Player
  const triggerHeadphonePlugIn = useCallback(() => {
    setPlugState((prev) => {
      if (prev === 'plugged' || prev === 'plugging') return prev;
      setTimeout(() => {
        mechanicalFoley.playHeadphonePlugIn();
        setPlugState('plugged');
      }, 240);
      return 'plugging';
    });
  }, []);

  useEffect(() => {
    if (isPortableActive && !prevPortableActiveRef.current) {
      triggerHeadphonePlugIn();
    } else if (!isPortableActive && prevPortableActiveRef.current) {
      setPlugState('unplugged');
    }
    prevPortableActiveRef.current = isPortableActive;
  }, [isPortableActive, triggerHeadphonePlugIn]);

  // Interactive 2D Verlet + Spring-Constraint Headphone Cord Simulation (60fps, zero React re-renders)
  useEffect(() => {
    if (plugState === 'unplugged') {
      cordNodesRef.current = [];
      return;
    }

    const NODE_COUNT = 15;
    let rafId = 0;

    const getEndpoints = () => {
      const stageEl = stageRef.current;
      const jackEl = jackAnchorRef.current;
      if (!stageEl || !jackEl) {
        return { startX: 300, startY: 40, endX: 460, endY: 440, w: 500, h: 480 };
      }
      const sRect = stageEl.getBoundingClientRect();
      const jRect = jackEl.getBoundingClientRect();
      const startX = jRect.left - sRect.left + jRect.width / 2;
      // Follow plug animation slightly upward while sliding in
      const plugOffset = plugState === 'plugging' ? -20 : 0;
      const startY = jRect.top - sRect.top + plugOffset;
      const endX = Math.max(startX + 75, sRect.width - 18);
      const endY = sRect.height - 14;
      return { startX, startY, endX, endY, w: sRect.width, h: sRect.height };
    };

    if (cordNodesRef.current.length !== NODE_COUNT) {
      const { startX, startY, endX, endY } = getEndpoints();
      const initNodes: CordNode[] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const u = i / (NODE_COUNT - 1);
        // Gentle initial arc outward to the right of the player chassis
        const x = startX + (endX - startX) * u + Math.sin(u * Math.PI) * 54;
        const y = startY + (endY - startY) * u - Math.sin(u * Math.PI) * 18;
        initNodes.push({ x, y, oldX: x, oldY: y });
      }
      cordNodesRef.current = initNodes;
    }

    const tick = () => {
      const nodes = cordNodesRef.current;
      if (nodes.length === NODE_COUNT) {
        const { startX, startY, endX, endY, w, h } = getEndpoints();
        const spanDist = Math.hypot(endX - startX, endY - startY);
        const restSegLen = Math.max(18, (spanDist * 1.16) / (NODE_COUNT - 1));

        // 1. Verlet Integration (momentum + gravity + subtle right-side drape bias so cord hangs cleanly beside player)
        for (let i = 1; i < NODE_COUNT - 1; i++) {
          const n = nodes[i];
          const vx = (n.x - n.oldX) * 0.92;
          const vy = (n.y - n.oldY) * 0.92;
          n.oldX = n.x;
          n.oldY = n.y;
          n.x += vx + 0.14;
          n.y += vy + 0.52;
        }

        // 2. Apply User Pointer Pull (elastic tug — NEVER unplugs Node 0!)
        if (cordGrabRef.current.active) {
          const gIdx = cordGrabRef.current.nodeIdx;
          const targetX = Math.max(14, Math.min(w - 14, cordGrabRef.current.pointerX));
          const targetY = Math.max(10, Math.min(h - 10, cordGrabRef.current.pointerY));
          const gNode = nodes[gIdx];
          if (gNode) {
            const stretchDist = Math.hypot(targetX - startX, targetY - startY);
            if (stretchDist > cordGrabRef.current.maxStretch) {
              cordGrabRef.current.maxStretch = stretchDist;
            }
            gNode.x += (targetX - gNode.x) * 0.65;
            gNode.y += (targetY - gNode.y) * 0.65;
          }
        }

        // 3. Iterative Spring-Distance Constraints + Locked Endpoints
        for (let iter = 0; iter < 10; iter++) {
          // Lock Node 0 permanently to the plugged-in 3.5mm boot
          nodes[0].x = startX;
          nodes[0].y = startY;
          // Guide Node 1 slightly upward out of the top vertical strain relief boot
          if (iter < 3 && !cordGrabRef.current.active) {
            nodes[1].y = Math.min(nodes[1].y, startY - 10);
          }
          // Lock final node at bottom-right exit
          nodes[NODE_COUNT - 1].x = endX;
          nodes[NODE_COUNT - 1].y = endY;

          for (let i = 0; i < NODE_COUNT - 1; i++) {
            const a = nodes[i];
            const b = nodes[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.001;
            const diff = (d - restSegLen) / d;
            const stiffness = cordGrabRef.current.active ? 0.62 : 0.82;

            if (i === 0) {
              b.x -= dx * diff * stiffness;
              b.y -= dy * diff * stiffness;
            } else if (i + 1 === NODE_COUNT - 1) {
              a.x += dx * diff * stiffness;
              a.y += dy * diff * stiffness;
            } else {
              const half = 0.5 * stiffness;
              a.x += dx * diff * half;
              a.y += dy * diff * half;
              b.x -= dx * diff * half;
              b.y -= dy * diff * half;
            }
          }

          // Keep interior nodes within stage boundaries
          for (let i = 1; i < NODE_COUNT - 1; i++) {
            nodes[i].x = Math.max(8, Math.min(w - 8, nodes[i].x));
            nodes[i].y = Math.max(6, Math.min(h - 8, nodes[i].y));
          }
        }

        // 4. Write SVG path strings directly
        const dStr = buildSmoothSvgPath(nodes);
        cordShadowPathRef.current?.setAttribute('d', dStr);
        cordBorderPathRef.current?.setAttribute('d', dStr);
        cordCorePathRef.current?.setAttribute('d', dStr);
        cordSheenPathRef.current?.setAttribute('d', dStr);
        cordHitPathRef.current?.setAttribute('d', dStr);

        // Position inline Y-splitter capsule along Node 11
        if (splitterGroupRef.current) {
          const sNode = nodes[11];
          const nextNode = nodes[12];
          const deg = (Math.atan2(nextNode.y - sNode.y, nextNode.x - sNode.x) * 180) / Math.PI;
          splitterGroupRef.current.setAttribute(
            'transform',
            `translate(${sNode.x.toFixed(1)}, ${sNode.y.toFixed(1)}) rotate(${deg.toFixed(1)})`
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [plugState]);

  const handleCordPointerDown = (e: React.PointerEvent<SVGPathElement>) => {
    const stageEl = stageRef.current;
    const nodes = cordNodesRef.current;
    if (!stageEl || nodes.length < 5) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = stageEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Pick closest interior node (2..NODE_COUNT-3)
    let bestIdx = 7;
    let bestDist = Infinity;
    for (let i = 2; i <= nodes.length - 3; i++) {
      const dist = Math.hypot(nodes[i].x - px, nodes[i].y - py);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    cordGrabRef.current = {
      active: true,
      nodeIdx: bestIdx,
      pointerX: px,
      pointerY: py,
      maxStretch: 0
    };
  };

  const handleCordPointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    if (!cordGrabRef.current.active || !stageElExists()) return;
    const rect = stageRef.current!.getBoundingClientRect();
    cordGrabRef.current.pointerX = e.clientX - rect.left;
    cordGrabRef.current.pointerY = e.clientY - rect.top;
  };

  function stageElExists() {
    return Boolean(stageRef.current);
  }

  const handleCordPointerUp = (e: React.PointerEvent<SVGPathElement>) => {
    if (!cordGrabRef.current.active) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const stretchScore = Math.min(1, cordGrabRef.current.maxStretch / 260);
    cordGrabRef.current.active = false;
    if (stretchScore > 0.12) {
      mechanicalFoley.playCordTwang(stretchScore);
    }
  };

  // Auto-scroll highlighted LCD row into view
  useEffect(() => {
    if (activeListRowRef.current) {
      activeListRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorByScreen, currentScreen]);

  const audioByNormPath = useMemo(() => {
    const map = new Map<string, MediaLibraryItem>();
    for (const item of audioItems) {
      map.set(item.filePath.replace(/[/\\]+/g, '\\').toLowerCase(), item);
    }
    return map;
  }, [audioItems]);

  const selectedMixtapeTracks: MediaLibraryItem[] = useMemo(() => {
    const m = mixtapes[openedMixtapeIdx];
    if (!m) return [];
    return m.trackPaths.map((tp, idx) => {
      const found = audioByNormPath.get(tp.replace(/[/\\]+/g, '\\').toLowerCase());
      if (found) return found;
      return {
        id: `pw_missing_${m.id}_${idx}`,
        title: tp.split(/[/\\]/).pop()?.replace(/\.mp3$/i, '') || tp,
        thumbnail: '',
        mediaType: 'audio',
        filePath: tp,
        fileSizeStr: '--',
        completedAt: m.createdAt
      };
    });
  }, [audioByNormPath, mixtapes, openedMixtapeIdx]);

  const repeatLabel =
    repeatMode === 'all' ? t.pwRepeatAll : repeatMode === 'one' ? t.pwRepeatOne : t.pwRepeatOff;

  const rootMenuItems = [
    { key: 'songs', label: `${t.pwMenuAllSongs} (${audioItems.length})`, hasSub: true },
    { key: 'mixtapes', label: `${t.pwMenuMixtapes} (${mixtapes.length})`, hasSub: true },
    { key: 'shuffle', label: t.pwMenuShuffle, hasSub: false },
    { key: 'repeat', label: `${t.pwMenuRepeat}: ${repeatLabel}`, hasSub: false },
    { key: 'nowPlaying', label: t.pwMenuNowPlaying, hasSub: true }
  ];

  const getItemCountForScreen = (scr: LcdScreenId): number => {
    switch (scr) {
      case 'root':
        return rootMenuItems.length;
      case 'songs':
        return audioItems.length;
      case 'mixtapes':
        return mixtapes.length;
      case 'mixtapeTracks':
        return selectedMixtapeTracks.length;
      default:
        return 0;
    }
  };

  // Execute 1 angular tick (+1 clockwise, -1 counter-clockwise)
  const stepWheelTick = (dir: 1 | -1) => {
    mechanicalFoley.playClickWheelTick();

    if (currentScreen === 'nowPlaying') {
      if (nowPlayingMode === 'scrub' && duration > 0) {
        seekAudio(Math.max(0, Math.min(duration, currentTime + dir * 4)));
      } else {
        setVolume(Math.max(0, Math.min(1, volume + dir * 0.04)));
      }
      return;
    }

    const total = getItemCountForScreen(currentScreen);
    if (total <= 0) return;

    setCursorByScreen((prev) => {
      const curr = prev[currentScreen] || 0;
      const next = Math.max(0, Math.min(total - 1, curr + dir));
      return { ...prev, [currentScreen]: next };
    });
  };

  const startPortablePlayback = async (tracks: MediaLibraryItem[], idx: number) => {
    const ok = await loadAndPlayQueue('portable', tracks, idx, true, null);
    if (ok) {
      triggerHeadphonePlugIn();
      setNowPlayingMode('volume');
      setScreenStack(['root', 'nowPlaying']);
    }
    return ok;
  };

  // Center Select Button Action
  const handleCenterSelect = async () => {
    mechanicalFoley.playClickWheelButton();

    if (currentScreen === 'root') {
      const idx = cursorByScreen.root || 0;
      const picked = rootMenuItems[idx];
      if (!picked) return;

      if (picked.key === 'songs') {
        setScreenStack((s) => [...s, 'songs']);
      } else if (picked.key === 'mixtapes') {
        setScreenStack((s) => [...s, 'mixtapes']);
      } else if (picked.key === 'shuffle') {
        if (audioItems.length > 0) {
          const shuffled = [...audioItems].sort(() => Math.random() - 0.5);
          await startPortablePlayback(shuffled, 0);
        }
      } else if (picked.key === 'repeat') {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const nextMode = order[(order.indexOf(repeatMode) + 1) % order.length];
        setRepeatMode(nextMode);
      } else if (picked.key === 'nowPlaying') {
        setNowPlayingMode('volume');
        setScreenStack((s) => [...s, 'nowPlaying']);
      }
      return;
    }

    if (currentScreen === 'songs') {
      const idx = cursorByScreen.songs || 0;
      if (audioItems[idx]) {
        await startPortablePlayback(audioItems, idx);
      }
      return;
    }

    if (currentScreen === 'mixtapes') {
      const idx = cursorByScreen.mixtapes || 0;
      if (mixtapes[idx]) {
        setOpenedMixtapeIdx(idx);
        setCursorByScreen((p) => ({ ...p, mixtapeTracks: 0 }));
        setScreenStack((s) => [...s, 'mixtapeTracks']);
      }
      return;
    }

    if (currentScreen === 'mixtapeTracks') {
      const idx = cursorByScreen.mixtapeTracks || 0;
      if (selectedMixtapeTracks[idx]) {
        await startPortablePlayback(selectedMixtapeTracks, idx);
      }
      return;
    }

    if (currentScreen === 'nowPlaying') {
      setNowPlayingMode((m) => (m === 'volume' ? 'scrub' : 'volume'));
    }
  };

  const handleMenuBack = () => {
    mechanicalFoley.playClickWheelButton();
    setNowPlayingMode('volume');
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleWheelPlayPause = async () => {
    mechanicalFoley.playClickWheelButton();
    if (currentTrack && activeMachine === 'portable') {
      if (isPlaying) pauseAudio();
      else await playAudio();
    } else if (audioItems.length > 0) {
      await startPortablePlayback(audioItems, 0);
    }
  };

  // Circular Pointer Angle Tracking on Click Wheel Ring
  const computePointerAngle = (clientX: number, clientY: number): { angle: number; dist: number } | null => {
    const el = wheelRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return {
      angle: Math.atan2(dy, dx),
      dist: Math.hypot(dx, dy)
    };
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const info = computePointerAngle(e.clientX, e.clientY);
    if (!info || info.dist < 32) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingWheelRef.current = true;
    lastWheelAngleRef.current = info.angle;
    accumAngleRef.current = 0;
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheelRef.current || lastWheelAngleRef.current === null) return;
    const info = computePointerAngle(e.clientX, e.clientY);
    if (!info || info.dist < 24) return;

    const rawDiff = info.angle - lastWheelAngleRef.current;
    const wrappedDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    lastWheelAngleRef.current = info.angle;
    accumAngleRef.current += wrappedDiff;

    const STEP_RAD = 0.29;
    while (accumAngleRef.current >= STEP_RAD) {
      accumAngleRef.current -= STEP_RAD;
      stepWheelTick(1);
    }
    while (accumAngleRef.current <= -STEP_RAD) {
      accumAngleRef.current += STEP_RAD;
      stepWheelTick(-1);
    }
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingWheelRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingWheelRef.current = false;
      lastWheelAngleRef.current = null;
      accumAngleRef.current = 0;
    }
  };

  const handleMouseWheelScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    stepWheelTick(e.deltaY > 0 ? 1 : -1);
  };

  const baseCompanionTracks = activeMachine === 'portable' && queue.length > 0 ? queue : audioItems;
  const normalizedCompanionQuery = companionSearch.normalize('NFC').trim().toLowerCase();
  const filteredCompanionEntries = useMemo(() => {
    return baseCompanionTracks
      .map((track, originalIdx) => ({ track, originalIdx }))
      .filter(({ track }) => {
        if (!normalizedCompanionQuery) return true;
        const tNorm = (track.title || '').normalize('NFC').toLowerCase();
        const fNorm = (track.filePath.split(/[/\\]/).pop() || '').normalize('NFC').toLowerCase();
        return tNorm.includes(normalizedCompanionQuery) || fNorm.includes(normalizedCompanionQuery);
      });
  }, [baseCompanionTracks, normalizedCompanionQuery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0">
      {/* LEFT: Iconic Anodized Pocket Click-Wheel Player + 3.5mm Headphone Plug-In + Draggable Elastic Cord */}
      <div
        ref={stageRef}
        className="lg:col-span-7 h-full min-h-0 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-zinc-900/35 border-2 border-[var(--color-border)] p-3"
      >
        {/* Pocket Player Chassis Wrapper (Shifted slightly left when plugged so cord drapes freely on the right) */}
        <div
          onWheel={handleMouseWheelScroll}
          className="relative z-10 w-full max-w-[296px] sm:-translate-x-5 rounded-[32px] bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-3 border-black p-4 shadow-[7px_7px_0px_0px_rgba(0,0,0,1),inset_0_2px_3px_rgba(255,255,255,0.5)] select-none flex flex-col items-center mt-5"
        >
          {/* Top Recessed 3.5mm Stereo Jack Port + Animated Headphone Plug */}
          <div className="absolute -top-[7px] right-9 flex flex-col items-center pointer-events-none">
            {/* Animated 3.5mm Stereo Plug & Strain Relief Boot */}
            <div
              className={`flex flex-col items-center transition-all duration-300 ease-out ${
                plugState === 'unplugged'
                  ? '-translate-y-12 opacity-0'
                  : plugState === 'plugging'
                  ? '-translate-y-5 opacity-100'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              {/* Top Flexible Rubber Strain-Relief Boot (Permanent anchor for elastic cord!) */}
              <div
                ref={jackAnchorRef}
                className="w-2.5 h-3.5 rounded-t-sm bg-zinc-100 border-x-2 border-t-2 border-black -mb-[1px]"
              />
              {/* Molded White Headphone Plug Barrel */}
              <div className="w-4 h-5 rounded-xs bg-gradient-to-r from-zinc-100 via-white to-zinc-300 border-2 border-black shadow-sm" />
              {/* Gold-Plated 3.5mm TRS Tip-Ring-Sleeve Pin (slides down inside socket when seated!) */}
              <div
                className={`w-1.5 bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-400 border-x border-black transition-all duration-250 ${
                  plugState === 'plugged' ? 'h-0.5' : 'h-4'
                }`}
              />
            </div>

            {/* Chrome 3.5mm Chassis Socket Bezel */}
            <div className="w-6 h-1.5 rounded-t-sm bg-gradient-to-r from-zinc-400 via-zinc-100 to-zinc-500 border-x-2 border-t-2 border-black" />
          </div>

          {/* Top Hold Switch Pill Detail */}
          <div className="absolute -top-[5px] left-9 w-7 h-1.5 rounded-t-sm bg-zinc-500 border-x-2 border-t-2 border-black pointer-events-none" />

          {/* Backlit Color LCD Screen with Glass Bezel */}
          <div className="w-full h-[186px] rounded-2xl bg-zinc-950 p-1.5 border-2 border-zinc-800 shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)]">
            <div className="w-full h-full rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900 overflow-hidden flex flex-col relative shadow-inner">
              {/* Classic Glossy LCD Status Header Bar */}
              <div className="h-5.5 px-2.5 bg-gradient-to-b from-slate-200 to-slate-300 border-b border-slate-400/80 flex items-center justify-between text-[10px] font-extrabold text-slate-800 shrink-0">
                <span className="truncate max-w-[165px]">
                  {currentScreen === 'root'
                    ? t.pwHeaderTitle
                    : currentScreen === 'songs'
                    ? t.pwMenuAllSongs
                    : currentScreen === 'mixtapes'
                    ? t.pwMenuMixtapes
                    : currentScreen === 'mixtapeTracks'
                    ? mixtapes[openedMixtapeIdx]?.name || t.pwMenuMixtapes
                    : t.pwMenuNowPlaying}
                </span>
                <div className="flex items-center gap-1.5">
                  {isPlaying && activeMachine === 'portable' ? (
                    <Play className="w-2.5 h-2.5 fill-sky-600 text-sky-600" />
                  ) : (
                    <Pause className="w-2.5 h-2.5 text-slate-500" />
                  )}
                  <div className="w-5 h-2.5 rounded-[2px] border border-slate-700 p-[1px] flex items-center relative">
                    <div className="h-full w-[82%] bg-emerald-500 rounded-[1px]" />
                    <span className="w-[2px] h-1.5 bg-slate-700 absolute -right-[3px] rounded-r-[1px]" />
                  </div>
                </div>
              </div>

              {/* LCD Screen Body */}
              <div className="flex-1 overflow-y-auto">
                {currentScreen === 'root' && (
                  <div className="divide-y divide-slate-300/60">
                    {rootMenuItems.map((item, idx) => {
                      const active = (cursorByScreen.root || 0) === idx;
                      return (
                        <div
                          key={item.key}
                          ref={active ? activeListRowRef : null}
                          onClick={() => {
                            setCursorByScreen((p) => ({ ...p, root: idx }));
                            setTimeout(() => handleCenterSelect(), 0);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                              : 'text-slate-800 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.hasSub && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentScreen === 'songs' &&
                  (audioItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-xs font-bold text-slate-500 text-center">
                      {t.pwEmptySongs}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-300/60">
                      {audioItems.map((song, idx) => {
                        const active = (cursorByScreen.songs || 0) === idx;
                        return (
                          <div
                            key={song.filePath}
                            ref={active ? activeListRowRef : null}
                            onClick={async () => {
                              setCursorByScreen((p) => ({ ...p, songs: idx }));
                              await startPortablePlayback(audioItems, idx);
                            }}
                            className={`px-3 py-1.5 text-[11px] font-bold flex items-center justify-between gap-2 cursor-pointer ${
                              active
                                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">{song.title}</span>
                            {currentTrack?.filePath === song.filePath && (
                              <Volume2 className="w-3 h-3 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {currentScreen === 'mixtapes' &&
                  (mixtapes.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-xs font-bold text-slate-500 text-center">
                      {t.pwEmptySongs}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-300/60">
                      {mixtapes.map((mx, idx) => {
                        const active = (cursorByScreen.mixtapes || 0) === idx;
                        return (
                          <div
                            key={mx.id}
                            ref={active ? activeListRowRef : null}
                            onClick={() => {
                              setCursorByScreen((p) => ({ ...p, mixtapes: idx, mixtapeTracks: 0 }));
                              setOpenedMixtapeIdx(idx);
                              setScreenStack((s) => [...s, 'mixtapeTracks']);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
                              active
                                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">{mx.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {currentScreen === 'mixtapeTracks' && (
                  <div className="divide-y divide-slate-300/60">
                    {selectedMixtapeTracks.map((song, idx) => {
                      const active = (cursorByScreen.mixtapeTracks || 0) === idx;
                      return (
                        <div
                          key={`${song.filePath}_${idx}`}
                          ref={active ? activeListRowRef : null}
                          onClick={async () => {
                            setCursorByScreen((p) => ({ ...p, mixtapeTracks: idx }));
                            await startPortablePlayback(selectedMixtapeTracks, idx);
                          }}
                          className={`px-3 py-1.5 text-[11px] font-bold flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                              : 'text-slate-800'
                          }`}
                        >
                          <span className="truncate">{song.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentScreen === 'nowPlaying' && (
                  <div className="h-full p-2.5 flex flex-col justify-between">
                    {currentTrack ? (
                      <>
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-16 rounded-lg border border-slate-400 shadow-md overflow-hidden shrink-0">
                            <MediaThumb
                              src={currentTrack.thumbnail}
                              filePath={currentTrack.filePath}
                              title={currentTrack.title}
                              mediaType="audio"
                              className="w-full h-full"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="text-[9px] font-bold text-slate-500">
                              {queue.length > 0 ? `${currentIndex + 1} / ${queue.length}` : '1 / 1'}
                            </div>
                            <div className="text-[11px] font-extrabold text-slate-900 line-clamp-2 leading-tight">
                              {currentTrack.title}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-sky-700">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>{repeatLabel}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-600">
                            <span>
                              {nowPlayingMode === 'scrub' ? t.pwScrubMode : t.pwVolumeMode}
                            </span>
                            <span>
                              {nowPlayingMode === 'scrub'
                                ? `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`
                                : `${Math.round(volume * 100)}%`}
                            </span>
                          </div>

                          <div className="w-full h-2 rounded-full bg-slate-300 border border-slate-400 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-100 ${
                                nowPlayingMode === 'scrub'
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                  : 'bg-gradient-to-r from-sky-400 to-blue-600'
                              }`}
                              style={{
                                width:
                                  nowPlayingMode === 'scrub'
                                    ? `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                                    : `${volume * 100}%`
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-600">
                            <span>{formatMediaTime(currentTime)}</span>
                            <span>-{formatMediaTime(Math.max(0, duration - currentTime))}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs font-bold text-slate-500 text-center">
                        {t.pwEmptySongs}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INTERACTIVE ANGULAR-TRACKING CLICK WHEEL */}
          <div className="mt-4 relative flex items-center justify-center">
            <div
              ref={wheelRef}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUp}
              onPointerCancel={handleWheelPointerUp}
              className="w-44 h-44 rounded-full bg-zinc-900 dark:bg-zinc-950 border-3 border-black shadow-[inset_0_2px_8px_rgba(255,255,255,0.12),0_4px_10px_rgba(0,0,0,0.45)] relative flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleMenuBack}
                className="absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-black tracking-widest text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                {t.pwWheelMenuBtn}
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  prevTrack();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  nextTrack();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleWheelPlayPause}
                className="absolute bottom-2.5 left-1/2 -translate-x-1/2 p-1 flex items-center gap-0.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <Pause className="w-3 h-3" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleCenterSelect}
                className="w-16 h-16 rounded-full bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-800 border-2 border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.45)] active:scale-95 transition-transform cursor-pointer"
              />
            </div>
          </div>

          <p className="mt-2 text-[10px] font-semibold text-zinc-700 dark:text-zinc-400 text-center leading-tight">
            {plugState !== 'unplugged' ? t.pwCordHint : t.pwWheelHint}
          </p>
        </div>

        {/* Interactive Elastic Physics Headphone Cord Overlay (Grab, pull, stretch & twang — permanently anchored to plug!) */}
        {plugState !== 'unplugged' && (
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible">
            {/* Soft Drop Shadow */}
            <path
              ref={cordShadowPathRef}
              fill="none"
              stroke="rgba(0,0,0,0.42)"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(2, 4)"
            />
            {/* Outer Black Cable Outline */}
            <path
              ref={cordBorderPathRef}
              fill="none"
              stroke="#09090B"
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Iconic White Rubberized Earphone Cord Core */}
            <path
              ref={cordCorePathRef}
              fill="none"
              stroke="#E4E4E7"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Specular Cable Highlight */}
            <path
              ref={cordSheenPathRef}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Molded Inline Y-Splitter Bead */}
            <g ref={splitterGroupRef}>
              <rect
                x="-8"
                y="-4.5"
                width="16"
                height="9"
                rx="4"
                fill="#F4F4F5"
                stroke="#09090B"
                strokeWidth="2"
              />
            </g>
            {/* Wide Invisible Draggable Hit Path so user can grab and twang the cord effortlessly */}
            <path
              ref={cordHitPathRef}
              fill="none"
              stroke="transparent"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={handleCordPointerDown}
              onPointerMove={handleCordPointerMove}
              onPointerUp={handleCordPointerUp}
              onPointerCancel={handleCordPointerUp}
              className="pointer-events-auto cursor-grab active:cursor-grabbing touch-none"
            />
          </svg>
        )}
      </div>

      {/* RIGHT: Companion Active Queue & Direct Library Quick-Select */}
      <div className="lg:col-span-5 pencil-box bg-[var(--color-surface)] p-3.5 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)]">
            {t.pwCompanionTitle} ({filteredCompanionEntries.length})
          </h3>
        </div>

        <div className="relative mb-2.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={companionSearch}
            onChange={(e) => setCompanionSearch(e.target.value)}
            placeholder={t.playerSearchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] select-text"
          />
        </div>

        {filteredCompanionEntries.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.pwEmptySongs}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filteredCompanionEntries.map(({ track, originalIdx }) => {
              const isCurrent = currentTrack?.filePath === track.filePath;
              return (
                <button
                  key={`${track.filePath}_${originalIdx}`}
                  type="button"
                  onClick={async () => {
                    mechanicalFoley.playClickWheelTick();
                    await startPortablePlayback(baseCompanionTracks, originalIdx);
                  }}
                  className={`w-full text-left p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isCurrent
                      ? 'bg-zinc-900 border-[var(--color-accent)] text-amber-300'
                      : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-[10px] font-mono opacity-60 w-5 shrink-0">
                      {String(originalIdx + 1).padStart(2, '0')}
                    </span>
                    <div className="w-8 h-8 rounded border border-black overflow-hidden shrink-0">
                      <MediaThumb
                        src={track.thumbnail}
                        filePath={track.filePath}
                        title={track.title}
                        mediaType="audio"
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-xs font-bold truncate">{track.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] opacity-65">{track.fileSizeStr}</span>
                    {isCurrent && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black/40 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
