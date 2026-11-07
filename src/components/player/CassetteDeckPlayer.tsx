import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Square,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search
} from 'lucide-react';
import { Mixtape, MixtapeShellColor, MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime } from '../../utils/mediaHelpers';
import { NeoDropdown, NeoDropdownOption } from '../NeoDropdown';
import { ConfirmModal } from '../ConfirmModal';
import { RotaryKnob } from './RotaryKnob';

interface CassetteDeckPlayerProps {
  language: Language;
}

const SHELL_THEMES: Record<
  MixtapeShellColor,
  { body: string; border: string; labelBg: string; labelText: string; swatch: string }
> = {
  charcoal: {
    body: 'from-zinc-800 via-zinc-900 to-zinc-950',
    border: 'border-zinc-600',
    labelBg: 'bg-amber-100',
    labelText: 'text-zinc-900',
    swatch: '#27272A'
  },
  ivory: {
    body: 'from-stone-200 via-stone-300 to-stone-400',
    border: 'border-stone-500',
    labelBg: 'bg-orange-500',
    labelText: 'text-white',
    swatch: '#E7E5E4'
  },
  amber: {
    body: 'from-amber-700/90 via-amber-800/90 to-amber-950/95',
    border: 'border-amber-500/70',
    labelBg: 'bg-amber-50',
    labelText: 'text-amber-950',
    swatch: '#D97706'
  },
  cobalt: {
    body: 'from-blue-700 via-blue-800 to-slate-950',
    border: 'border-blue-400/60',
    labelBg: 'bg-sky-100',
    labelText: 'text-slate-900',
    swatch: '#1D4ED8'
  },
  crimson: {
    body: 'from-rose-700 via-red-800 to-rose-950',
    border: 'border-rose-400/60',
    labelBg: 'bg-rose-50',
    labelText: 'text-rose-950',
    swatch: '#BE123C'
  },
  emerald: {
    body: 'from-emerald-700 via-teal-800 to-emerald-950',
    border: 'border-emerald-400/60',
    labelBg: 'bg-emerald-50',
    labelText: 'text-emerald-950',
    swatch: '#047857'
  }
};

interface ResolvedMixtape {
  id: string;
  name: string;
  color: MixtapeShellColor;
  tracks: MediaLibraryItem[];
  isBuiltIn: boolean;
}

export const CassetteDeckPlayer: React.FC<CassetteDeckPlayerProps> = ({ language }) => {
  const t = translations[language];
  const {
    audioItems,
    mixtapes,
    saveMixtapesOptimistic,
    activeMachine,
    loadedMixtapeId,
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    loadAndPlayQueue,
    playAudio,
    pauseAudio,
    stopAndUnloadAudio,
    nextTrack,
    prevTrack,
    setVolume,
    getVuLevels
  } = useAudioDeck();

  const isThisDeckActive = activeMachine === 'cassette';

  const [doorOpen, setDoorOpen] = useState<boolean>(!isThisDeckActive);
  const [selectedTapeId, setSelectedTapeId] = useState<string | null>(
    isThisDeckActive ? loadedMixtapeId : null
  );
  const [fastWindVisual, setFastWindVisual] = useState<'none' | 'rew' | 'ff'>('none');
  const [vuLevels, setVuLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  // Mixtape Creator / Editor Modal State (strictly cleaned on close)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTapeId, setEditingTapeId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftColor, setDraftColor] = useState<MixtapeShellColor>('amber');
  const [draftTrackPaths, setDraftTrackPaths] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState<string>('');

  // Delete confirmation modal state
  const [pendingDeleteTapeId, setPendingDeleteTapeId] = useState<string | null>(null);

  // Reel Sprocket Rotation Refs
  const leftReelRef = useRef<SVGGElement | null>(null);
  const rightReelRef = useRef<SVGGElement | null>(null);
  const reelAngleRef = useRef<number>(0);

  // Build map of audio items by normalized path for mixtape resolution
  const audioByNormPath = useMemo(() => {
    const map = new Map<string, MediaLibraryItem>();
    for (const item of audioItems) {
      map.set(item.filePath.replace(/[/\\]+/g, '\\').toLowerCase(), item);
    }
    return map;
  }, [audioItems]);

  const allResolvedMixtapes: ResolvedMixtape[] = useMemo(() => {
    const builtIns: ResolvedMixtape[] = [];
    if (audioItems.length > 0) {
      builtIns.push({
        id: '__auto_all__',
        name: t.csAutoAllName,
        color: 'charcoal',
        tracks: audioItems,
        isBuiltIn: true
      });
      const recentSorted = [...audioItems]
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, 12);
      builtIns.push({
        id: '__auto_recent__',
        name: t.csAutoRecentName,
        color: 'amber',
        tracks: recentSorted,
        isBuiltIn: true
      });
    }

    const customs: ResolvedMixtape[] = mixtapes.map((m) => {
      const resolvedTracks: MediaLibraryItem[] = m.trackPaths.map((tp, idx) => {
        const norm = tp.replace(/[/\\]+/g, '\\').toLowerCase();
        const found = audioByNormPath.get(norm);
        if (found) return found;
        // Keep missing track visible in mixtape until played so Honest Notice + Disintegration handles it!
        const fallbackTitle = tp.split(/[/\\]/).pop()?.replace(/\.mp3$/i, '') || tp;
        return {
          id: `missing_${m.id}_${idx}`,
          title: fallbackTitle,
          thumbnail: '',
          mediaType: 'audio',
          filePath: tp,
          fileSizeStr: '--',
          completedAt: m.createdAt
        };
      });

      return {
        id: m.id,
        name: m.name,
        color: m.color || 'charcoal',
        tracks: resolvedTracks,
        isBuiltIn: false
      };
    });

    return [...customs, ...builtIns];
  }, [audioByNormPath, audioItems, mixtapes, t.csAutoAllName, t.csAutoRecentName]);

  const activeTape: ResolvedMixtape | null = useMemo(() => {
    const targetId = isThisDeckActive && loadedMixtapeId ? loadedMixtapeId : selectedTapeId;
    if (!targetId) return null;
    return allResolvedMixtapes.find((m) => m.id === targetId) || null;
  }, [allResolvedMixtapes, isThisDeckActive, loadedMixtapeId, selectedTapeId]);

  // Animate Cassette Sprockets + Live Stereo VU Meters
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      let speedDeg = 0;
      if (fastWindVisual === 'ff') speedDeg = -560;
      else if (fastWindVisual === 'rew') speedDeg = 560;
      else if (isThisDeckActive && isPlaying && !doorOpen) speedDeg = -95;

      if (speedDeg !== 0) {
        reelAngleRef.current = (reelAngleRef.current + speedDeg * dt) % 360;
        const rot = `rotate(${reelAngleRef.current.toFixed(1)} 0 0)`;
        if (leftReelRef.current) leftReelRef.current.setAttribute('transform', rot);
        if (rightReelRef.current) rightReelRef.current.setAttribute('transform', rot);
      }

      if (isThisDeckActive && isPlaying) {
        setVuLevels(getVuLevels());
      } else {
        setVuLevels((prev) =>
          prev.left === 0 && prev.right === 0 ? prev : { left: prev.left * 0.75, right: prev.right * 0.75 }
        );
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [doorOpen, fastWindVisual, getVuLevels, isPlaying, isThisDeckActive]);

  const handleLoadCassette = async (tape: ResolvedMixtape) => {
    if (tape.tracks.length === 0) return;
    mechanicalFoley.playCassetteLoadAndClose();
    setSelectedTapeId(tape.id);
    setDoorOpen(false);
    await loadAndPlayQueue('cassette', tape.tracks, 0, false, tape.id);
  };

  const handlePianoPlay = async () => {
    if (!activeTape || activeTape.tracks.length === 0) return;
    mechanicalFoley.playPianoKeyLatch();
    setDoorOpen(false);
    if (!isThisDeckActive || loadedMixtapeId !== activeTape.id) {
      await loadAndPlayQueue('cassette', activeTape.tracks, 0, true, activeTape.id);
    } else {
      await playAudio();
    }
  };

  const handlePianoPause = async () => {
    if (!activeTape) return;
    if (isThisDeckActive && isPlaying) {
      mechanicalFoley.playPianoKeyLatch();
      pauseAudio();
    } else if (isThisDeckActive && !isPlaying) {
      mechanicalFoley.playPianoKeyRelease();
      await playAudio();
    }
  };

  const handlePianoRew = async () => {
    if (!activeTape || !isThisDeckActive) return;
    mechanicalFoley.playTapeFastWind();
    setFastWindVisual('rew');
    setTimeout(() => setFastWindVisual('none'), 340);
    await prevTrack();
  };

  const handlePianoFf = async () => {
    if (!activeTape || !isThisDeckActive) return;
    mechanicalFoley.playTapeFastWind();
    setFastWindVisual('ff');
    setTimeout(() => setFastWindVisual('none'), 340);
    await nextTrack();
  };

  const handlePianoStopEject = () => {
    if (isThisDeckActive && isPlaying) {
      // First press stops tape transport cleanly
      mechanicalFoley.playPianoKeyRelease();
      pauseAudio();
    } else {
      // Second press (or when stopped) pops hinged cassette door open and unloads
      mechanicalFoley.playCassetteDoorOpen();
      setDoorOpen(true);
      setSelectedTapeId(null);
      if (isThisDeckActive) {
        stopAndUnloadAudio();
      }
    }
  };

  // Mixtape Modal Handlers with Strict State Cleanup
  const closeAndResetModal = () => {
    setIsModalOpen(false);
    setEditingTapeId(null);
    setDraftName('');
    setDraftColor('amber');
    setDraftTrackPaths([]);
    setModalSearch('');
  };

  const openCreateModal = () => {
    mechanicalFoley.playClickWheelButton();
    setEditingTapeId(null);
    setDraftName('');
    setDraftColor('amber');
    setDraftTrackPaths([]);
    setModalSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (tape: ResolvedMixtape, e: React.MouseEvent) => {
    e.stopPropagation();
    const raw = mixtapes.find((m) => m.id === tape.id);
    if (!raw) return;
    mechanicalFoley.playClickWheelButton();
    setEditingTapeId(raw.id);
    setDraftName(raw.name);
    setDraftColor(raw.color);
    setDraftTrackPaths([...raw.trackPaths]);
    setModalSearch('');
    setIsModalOpen(true);
  };

  const handleSaveMixtape = () => {
    const cleanName = draftName.trim();
    if (!cleanName || draftTrackPaths.length === 0) return;

    mechanicalFoley.playCassetteLoadAndClose();
    if (editingTapeId) {
      const updated = mixtapes.map((m) =>
        m.id === editingTapeId
          ? { ...m, name: cleanName, color: draftColor, trackPaths: draftTrackPaths }
          : m
      );
      saveMixtapesOptimistic(updated);
    } else {
      const created: Mixtape = {
        id: `mixtape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        color: draftColor,
        trackPaths: draftTrackPaths,
        createdAt: Date.now()
      };
      saveMixtapesOptimistic([created, ...mixtapes]);
      setSelectedTapeId(created.id);
    }
    closeAndResetModal();
  };

  const confirmDeleteMixtape = () => {
    if (!pendingDeleteTapeId) return;
    const targetId = pendingDeleteTapeId;
    setPendingDeleteTapeId(null);
    if (selectedTapeId === targetId) setSelectedTapeId(null);
    if (isThisDeckActive && loadedMixtapeId === targetId) {
      stopAndUnloadAudio();
      setDoorOpen(true);
    }
    saveMixtapesOptimistic(mixtapes.filter((m) => m.id !== targetId));
  };

  const toggleDraftTrack = (filePath: string) => {
    mechanicalFoley.playClickWheelTick();
    setDraftTrackPaths((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    );
  };

  const colorOptions: NeoDropdownOption<MixtapeShellColor>[] = [
    { value: 'charcoal', label: t.csColorCharcoal },
    { value: 'ivory', label: t.csColorIvory },
    { value: 'amber', label: t.csColorAmber },
    { value: 'cobalt', label: t.csColorCobalt },
    { value: 'crimson', label: t.csColorCrimson },
    { value: 'emerald', label: t.csColorEmerald }
  ];

  // Calculate proportional left/right magnetic tape spool radii
  const totalTapeTracks = activeTape ? Math.max(1, activeTape.tracks.length) : 1;
  const activeIdx = isThisDeckActive ? currentIndex : 0;
  const trackFrac = duration > 0 && isThisDeckActive ? currentTime / duration : 0;
  const overallTapeProgress = activeTape
    ? Math.min(1, Math.max(0, (activeIdx + trackFrac) / totalTapeTracks))
    : 0;

  const leftSpoolRadius = 42 - overallTapeProgress * 20; // shrinks from 42 -> 22
  const rightSpoolRadius = 22 + overallTapeProgress * 20; // grows from 22 -> 42

  // 4-digit mechanical tape counter
  const counterVal = isThisDeckActive
    ? String(Math.floor(activeIdx * 120 + currentTime) % 10000).padStart(4, '0')
    : '0000';

  const shellStyle = SHELL_THEMES[activeTape?.color || 'charcoal'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT: Stereo Cassette Deck Hardware */}
      <div className="lg:col-span-8 rounded-2xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border-3 border-black dark:border-zinc-700 p-4 md:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-zinc-100">
        {/* Top Brushed Faceplate: Model Badge + 4-Digit Mechanical Tape Counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isThisDeckActive && isPlaying
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                  : 'bg-amber-500/70'
              }`}
            />
            <span className="text-[11px] font-black tracking-widest uppercase text-zinc-300">
              {t.csModelPlate}
            </span>
          </div>

          {/* 4-Digit Mechanical Odometer Counter */}
          <div className="flex items-center gap-1 bg-black px-2.5 py-1 rounded border-2 border-zinc-700 shadow-inner">
            {counterVal.split('').map((digit, i) => (
              <span
                key={i}
                className="w-4 h-5 bg-zinc-900 border border-zinc-700 rounded-xs flex items-center justify-center font-mono text-xs font-black text-zinc-100"
              >
                {digit}
              </span>
            ))}
          </div>
        </div>

        {/* Center Stage: Hinged Cassette Compartment Door + Live Stereo VU Meters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Hinged Smoked-Acrylic Cassette Well */}
          <div className="md:col-span-8 rounded-2xl bg-[#07080A] border-2 border-zinc-700 p-4 relative shadow-[inset_0_8px_22px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center min-h-[245px]">
            <div
              className={`w-full max-w-[360px] transition-all duration-300 ${
                doorOpen ? 'scale-[1.03] -translate-y-1 drop-shadow-[0_16px_18px_rgba(0,0,0,0.9)]' : 'scale-100'
              }`}
            >
              {activeTape ? (
                /* Physical Compact Cassette Shell inside Door */
                <div
                  className={`rounded-xl bg-gradient-to-b ${shellStyle.body} border-2 ${shellStyle.border} p-3 shadow-xl relative`}
                >
                  {/* Top Index Sticker */}
                  <div className={`${shellStyle.labelBg} ${shellStyle.labelText} rounded-md px-3 py-1.5 border border-black/20 shadow-xs`}>
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider opacity-75">
                      <span>{t.csSideBadge}</span>
                      <span>
                        {isThisDeckActive ? `${currentIndex + 1}/${activeTape.tracks.length}` : `${activeTape.tracks.length} ${t.csTracksUnit}`}
                      </span>
                    </div>
                    <div className="text-xs font-black truncate mt-0.5">
                      {activeTape.name}
                    </div>
                  </div>

                  {/* Center Smoked Transparent Tape Spool Window */}
                  <div className="mt-2.5 mx-auto w-full h-24 rounded-lg bg-zinc-950/92 border-2 border-zinc-700/80 relative overflow-hidden flex items-center justify-center">
                    <svg viewBox="0 0 280 96" className="w-full h-full">
                      {/* Magnetic Ferric-Oxide Tape Spools (Dynamic Radii!) */}
                      <circle cx="82" cy="48" r={leftSpoolRadius} fill="#291A14" stroke="#3F271E" strokeWidth="1.5" />
                      <circle cx="198" cy="48" r={rightSpoolRadius} fill="#291A14" stroke="#3F271E" strokeWidth="1.5" />

                      {/* Center Measurement Scale Window */}
                      <rect x="116" y="34" width="48" height="28" rx="3" fill="#09090B" stroke="#3F3F46" strokeWidth="1" />
                      <line x1="122" y1="48" x2="158" y2="48" stroke="#71717A" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Left Rotating 6-Spline Sprocket Hub */}
                      <g transform="translate(82, 48)">
                        <g ref={leftReelRef}>
                          <circle cx="0" cy="0" r="16" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
                          <circle cx="0" cy="0" r="9" fill="#09090B" />
                          {[0, 60, 120, 180, 240, 300].map((deg) => (
                            <rect
                              key={deg}
                              x="-2"
                              y="-15"
                              width="4"
                              height="6"
                              fill="#18181B"
                              transform={`rotate(${deg})`}
                            />
                          ))}
                        </g>
                      </g>

                      {/* Right Rotating 6-Spline Sprocket Hub */}
                      <g transform="translate(198, 48)">
                        <g ref={rightReelRef}>
                          <circle cx="0" cy="0" r="16" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
                          <circle cx="0" cy="0" r="9" fill="#09090B" />
                          {[0, 60, 120, 180, 240, 300].map((deg) => (
                            <rect
                              key={deg}
                              x="-2"
                              y="-15"
                              width="4"
                              height="6"
                              fill="#18181B"
                              transform={`rotate(${deg})`}
                            />
                          ))}
                        </g>
                      </g>
                    </svg>
                  </div>

                  {/* Bottom Trapezoid Head Shield */}
                  <div className="mt-2 mx-6 h-4 rounded-t-md bg-black/45 border-t border-x border-white/15 flex items-center justify-around px-6">
                    <span className="w-2 h-2 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-2 h-2 rounded-full bg-zinc-950 border border-zinc-600" />
                  </div>
                </div>
              ) : (
                /* Empty Metal Tape Head Mechanism Cage */
                <div className="h-44 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center p-5 text-center">
                  <div className="flex items-center gap-12 mb-3 opacity-45">
                    <span className="w-7 h-7 rounded-full border-2 border-zinc-400" />
                    <span className="w-7 h-7 rounded-full border-2 border-zinc-400" />
                  </div>
                  <p className="text-xs font-bold text-zinc-400">
                    {t.csNoTapePrompt}
                  </p>
                </div>
              )}
            </div>

            {/* Door Status Badge */}
            <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {doorOpen ? t.csDoorOpenStatus : t.csDoorClosedStatus}
            </div>
          </div>

          {/* Right Panel: Dual Live Stereo Peak LED VU Meters + Volume Knob */}
          <div className="md:col-span-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 p-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex justify-between">
                <span>{t.csVuMeterTitle}</span>
                <span className="text-amber-400">{t.csVuUnit}</span>
              </div>

              {/* Left & Right Segmented LED Bars */}
              {(['L', 'R'] as const).map((ch) => {
                const level = ch === 'L' ? vuLevels.left : vuLevels.right;
                const chLabel = ch === 'L' ? t.csChannelLeft : t.csChannelRight;
                const litSegments = Math.round(level * 12);
                return (
                  <div key={ch} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-zinc-300 w-3">
                      {chLabel}
                    </span>
                    <div className="flex-1 grid grid-cols-12 gap-1 bg-black p-1 rounded border border-zinc-800">
                      {Array.from({ length: 12 }).map((_, segIdx) => {
                        const isLit = segIdx < litSegments;
                        const colorCls =
                          segIdx >= 10
                            ? isLit
                              ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.9)]'
                              : 'bg-red-950/35'
                            : segIdx >= 7
                            ? isLit
                              ? 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.85)]'
                              : 'bg-amber-950/35'
                            : isLit
                            ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.85)]'
                            : 'bg-emerald-950/35';
                        return <span key={segIdx} className={`h-3 rounded-[1px] transition-colors ${colorCls}`} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Track Readout */}
            <div className="my-2 p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px]">
              <div className="font-bold text-amber-300 truncate">
                {isThisDeckActive && currentTrack
                  ? currentTrack.title
                  : activeTape
                  ? activeTape.name
                  : '--'}
              </div>
              <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                {isThisDeckActive
                  ? `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`
                  : '00:00 / 00:00'}
              </div>
            </div>

            <div className="flex justify-center">
              <RotaryKnob value={volume} onChange={setVolume} label={t.tvVolumeLabel} size={44} />
            </div>
          </div>
        </div>

        {/* MECHANICAL LATCHING PIANO-KEY TRANSPORT BAR */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <div className="grid grid-cols-5 gap-2 bg-black p-2 rounded-xl border-2 border-zinc-800">
            {/* PLAY KEY (Physically stays depressed while playing!) */}
            <button
              type="button"
              disabled={!activeTape}
              onClick={handlePianoPlay}
              className={`py-3 px-2 rounded-lg border-2 border-black font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                isThisDeckActive && isPlaying
                  ? 'translate-y-[4px] bg-amber-400 text-black shadow-inner'
                  : 'bg-gradient-to-b from-zinc-200 to-zinc-400 text-zinc-950 shadow-[0_5px_0_0_#18181B] hover:from-white hover:to-zinc-300'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>{t.csKeyPlay}</span>
            </button>

            {/* REWIND KEY */}
            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoRew}
              className={`py-3 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                fastWindVisual === 'rew'
                  ? 'translate-y-[4px] bg-zinc-500 text-white shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_5px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <Rewind className="w-4 h-4" />
              <span>{t.csKeyRew}</span>
            </button>

            {/* FAST-FORWARD KEY */}
            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoFf}
              className={`py-3 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                fastWindVisual === 'ff'
                  ? 'translate-y-[4px] bg-zinc-500 text-white shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_5px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <FastForward className="w-4 h-4" />
              <span>{t.csKeyFf}</span>
            </button>

            {/* PAUSE KEY */}
            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoPause}
              className={`py-3 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                isThisDeckActive && !isPlaying && queue.length > 0
                  ? 'translate-y-[4px] bg-amber-500/80 text-black shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_5px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <Pause className="w-4 h-4" />
              <span>{t.csKeyPause}</span>
            </button>

            {/* STOP / EJECT KEY */}
            <button
              type="button"
              onClick={handlePianoStopEject}
              className="py-3 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_5px_0_0_#18181B] active:translate-y-[4px] active:shadow-inner transition-all cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>{t.csKeyStopEject}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Cassette Mixtape Rack + Custom Mixtape Builder Button */}
      <div className="lg:col-span-4 pencil-box bg-[var(--color-surface)] p-4 flex flex-col h-[540px]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)] truncate">
            {t.csShelfTitle}
          </h3>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-2.5 py-1.5 text-[11px] font-bold bg-[var(--color-accent)] text-[var(--color-bg)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.csNewMixtapeBtn}</span>
          </button>
        </div>

        {allResolvedMixtapes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.ttEmptyCrate}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {allResolvedMixtapes.map((tape) => {
              const isLoaded = activeTape?.id === tape.id && !doorOpen;
              const st = SHELL_THEMES[tape.color];

              return (
                <div
                  key={tape.id}
                  onClick={() => handleLoadCassette(tape)}
                  className={`rounded-xl p-2.5 border-2 transition-all cursor-pointer ${
                    isLoaded
                      ? 'bg-zinc-900 border-[var(--color-accent)]'
                      : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Cassette Spine Preview */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="w-4 h-9 rounded-sm border border-black shrink-0 shadow-inner"
                        style={{ backgroundColor: st.swatch }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-extrabold truncate ${
                            isLoaded ? 'text-amber-300' : 'text-[var(--color-text-main)]'
                          }`}
                        >
                          {tape.name}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {tape.tracks.length} {t.csTracksUnit}
                        </div>
                      </div>
                    </div>

                    {!tape.isBuiltIn && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(tape, e)}
                          className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
                          title={t.csEditMixtapeBtn}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteTapeId(tape.id);
                          }}
                          className="p-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/15 cursor-pointer"
                          title={t.csDeleteMixtapeBtn}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Mixtape Creator / Editor Modal (Uses NeoDropdown — Zero native select!) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="pencil-box w-full max-w-lg bg-[var(--color-surface)] border-2 border-[var(--color-border)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)]">
                {editingTapeId ? t.csModalEditTitle : t.csModalCreateTitle}
              </h3>
              <button
                type="button"
                onClick={closeAndResetModal}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7 space-y-1">
                <label className="text-[11px] font-bold text-[var(--color-text-muted)] block">
                  {t.csModalNameLabel}
                </label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={t.csModalNamePlaceholder}
                  className="w-full px-3 py-1.5 text-xs rounded bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-[var(--color-text-muted)] block">
                  {t.csModalColorLabel}
                </label>
                <NeoDropdown
                  value={draftColor}
                  onChange={setDraftColor}
                  options={colorOptions}
                  size="sm"
                />
              </div>
            </div>

            {/* Track Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[var(--color-text-muted)]">
                  {t.csModalSelectTracks} ({draftTrackPaths.length})
                </label>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder={t.playerSearchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 border-2 border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg)]">
                {audioItems
                  .filter((a) => a.title.toLowerCase().includes(modalSearch.trim().toLowerCase()))
                  .map((track) => {
                    const checked = draftTrackPaths.includes(track.filePath);
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => toggleDraftTrack(track.filePath)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[var(--color-surface)] border-[var(--color-accent)] font-bold text-[var(--color-text-main)]'
                            : 'border-transparent hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        <span className="truncate">{track.title}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            checked
                              ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-black'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeAndResetModal}
                className="px-4 py-2 text-xs font-bold bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                {t.cancelModalBtn}
              </button>
              <button
                type="button"
                disabled={!draftName.trim() || draftTrackPaths.length === 0}
                onClick={handleSaveMixtape}
                className="px-4 py-2 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40 border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                {t.csModalSaveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Mixtape Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteTapeId)}
        title={t.csDeleteMixtapeBtn}
        message={t.csConfirmDeleteMixtape}
        confirmText={t.confirmBtn}
        cancelText={t.cancelModalBtn}
        onConfirm={confirmDeleteMixtape}
        onCancel={() => setPendingDeleteTapeId(null)}
      />
    </div>
  );
};
