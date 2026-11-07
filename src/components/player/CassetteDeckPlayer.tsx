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
  Search,
  ListMusic,
  ImagePlus,
  Crop
} from 'lucide-react';
import { Mixtape, MixtapeShellColor, MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime } from '../../utils/mediaHelpers';
import { ConfirmModal } from '../ConfirmModal';
import { RotaryKnob } from './RotaryKnob';
import { MediaThumb } from './MediaThumb';
import { ImageCropperModal } from './ImageCropperModal';

interface CassetteDeckPlayerProps {
  language: Language;
}

const SHELL_THEMES: Record<
  MixtapeShellColor,
  {
    body: string;
    border: string;
    labelBg: string;
    labelText: string;
    stripeCss: string;
    swatch: string;
  }
> = {
  charcoal: {
    body: 'from-zinc-800 via-zinc-900 to-zinc-950',
    border: 'border-zinc-500',
    labelBg: 'bg-amber-100',
    labelText: 'text-zinc-900',
    stripeCss: 'linear-gradient(90deg, #F59E0B 0%, #EA580C 50%, #DC2626 100%)',
    swatch: '#27272A'
  },
  ivory: {
    body: 'from-stone-100 via-stone-200 to-stone-300',
    border: 'border-stone-500',
    labelBg: 'bg-orange-500',
    labelText: 'text-white',
    stripeCss: 'linear-gradient(90deg, #FDE047 0%, #FB923C 50%, #7C2D12 100%)',
    swatch: '#E7E5E4'
  },
  amber: {
    body: 'from-amber-600 via-amber-800 to-amber-950',
    border: 'border-amber-400/80',
    labelBg: 'bg-amber-50',
    labelText: 'text-amber-950',
    stripeCss: 'linear-gradient(90deg, #FBBF24 0%, #B45309 50%, #451A03 100%)',
    swatch: '#D97706'
  },
  cobalt: {
    body: 'from-blue-600 via-blue-800 to-slate-950',
    border: 'border-sky-400/75',
    labelBg: 'bg-sky-100',
    labelText: 'text-slate-900',
    stripeCss: 'linear-gradient(90deg, #38BDF8 0%, #2563EB 50%, #1E1B4B 100%)',
    swatch: '#1D4ED8'
  },
  crimson: {
    body: 'from-rose-600 via-red-800 to-rose-950',
    border: 'border-rose-400/75',
    labelBg: 'bg-rose-50',
    labelText: 'text-rose-950',
    stripeCss: 'linear-gradient(90deg, #FB7185 0%, #E11D48 50%, #881337 100%)',
    swatch: '#BE123C'
  },
  emerald: {
    body: 'from-emerald-600 via-teal-800 to-emerald-950',
    border: 'border-emerald-400/75',
    labelBg: 'bg-emerald-50',
    labelText: 'text-emerald-950',
    stripeCss: 'linear-gradient(90deg, #34D399 0%, #059669 50%, #064E3B 100%)',
    swatch: '#047857'
  }
};

interface ResolvedMixtape {
  id: string;
  name: string;
  color: MixtapeShellColor;
  customImage?: string;
  tracks: MediaLibraryItem[];
  isBuiltIn: boolean;
}

const MiniCassettePreview: React.FC<{
  color: MixtapeShellColor;
  customImage?: string;
  className?: string;
}> = ({ color, customImage, className = 'w-16 h-10' }) => {
  const st = SHELL_THEMES[color];
  return (
    <div
      className={`rounded-md bg-gradient-to-b ${st.body} border-2 ${st.border} p-1 relative overflow-hidden shrink-0 shadow-sm flex flex-col justify-between ${className}`}
    >
      {customImage && (
        <img
          src={customImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none"
          draggable={false}
        />
      )}
      {/* Top Patterned Cassette Label Band */}
      <div
        className={`relative z-10 h-2 rounded-[2px] overflow-hidden border border-black/25 ${
          customImage ? 'bg-black/45' : st.labelBg
        }`}
      >
        {!customImage && (
          <div className="w-full h-1" style={{ background: st.stripeCss }} />
        )}
      </div>

      {/* Twin Reel Window */}
      <div className="relative z-10 mx-1 h-3.5 rounded-[2px] bg-zinc-950/90 border border-zinc-600/80 flex items-center justify-around px-1">
        <span className="w-2 h-2 rounded-full border border-zinc-300 bg-zinc-900" />
        <span className="w-2.5 h-1 bg-zinc-800 rounded-[1px]" />
        <span className="w-2 h-2 rounded-full border border-zinc-300 bg-zinc-900" />
      </div>

      {/* Bottom Head Trapezoid */}
      <div className="relative z-10 mx-2 h-1 rounded-t-[2px] bg-black/55 border-t border-x border-white/20" />
    </div>
  );
};

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
  const [rightPanelTab, setRightPanelTab] = useState<'mixtapes' | 'tracklist'>('mixtapes');
  const [fastWindVisual, setFastWindVisual] = useState<'none' | 'rew' | 'ff'>('none');
  const [vuLevels, setVuLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  // Mixtape Creator / Editor Modal State (strictly cleaned on close)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTapeId, setEditingTapeId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftColor, setDraftColor] = useState<MixtapeShellColor>('amber');
  const [draftCustomImage, setDraftCustomImage] = useState<string | undefined>(undefined);
  const [rawImageForCropper, setRawImageForCropper] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false);
  const [draftTrackPaths, setDraftTrackPaths] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        customImage: m.customImage,
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

  const handleLoadCassette = async (tape: ResolvedMixtape, openTracklist = false) => {
    if (tape.tracks.length === 0) return;
    mechanicalFoley.playCassetteLoadAndClose();
    setSelectedTapeId(tape.id);
    setDoorOpen(false);
    if (openTracklist) {
      setRightPanelTab('tracklist');
    }
    if (!isThisDeckActive || loadedMixtapeId !== tape.id) {
      await loadAndPlayQueue('cassette', tape.tracks, 0, false, tape.id);
    }
  };

  const handlePlaySpecificTrackInTape = async (tape: ResolvedMixtape, trackIndex: number) => {
    mechanicalFoley.playPianoKeyLatch();
    setSelectedTapeId(tape.id);
    setDoorOpen(false);
    await loadAndPlayQueue('cassette', tape.tracks, trackIndex, true, tape.id);
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
      mechanicalFoley.playPianoKeyRelease();
      pauseAudio();
    } else {
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
    setIsCropperOpen(false);
    setRawImageForCropper(null);
    setEditingTapeId(null);
    setDraftName('');
    setDraftColor('amber');
    setDraftCustomImage(undefined);
    setDraftTrackPaths([]);
    setModalSearch('');
  };

  const openCreateModal = () => {
    mechanicalFoley.playClickWheelButton();
    setEditingTapeId(null);
    setDraftName('');
    setDraftColor('amber');
    setDraftCustomImage(undefined);
    setRawImageForCropper(null);
    setIsCropperOpen(false);
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
    setDraftCustomImage(raw.customImage);
    setRawImageForCropper(raw.customImage || null);
    setIsCropperOpen(false);
    setDraftTrackPaths([...raw.trackPaths]);
    setModalSearch('');
    setIsModalOpen(true);
  };

  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawImageForCropper(reader.result);
        setIsCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMixtape = () => {
    const cleanName = draftName.trim();
    if (!cleanName || draftTrackPaths.length === 0) return;

    mechanicalFoley.playCassetteLoadAndClose();
    if (editingTapeId) {
      const updated = mixtapes.map((m) =>
        m.id === editingTapeId
          ? {
              ...m,
              name: cleanName,
              color: draftColor,
              customImage: draftCustomImage,
              trackPaths: draftTrackPaths
            }
          : m
      );
      saveMixtapesOptimistic(updated);
    } else {
      const created: Mixtape = {
        id: `mixtape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        color: draftColor,
        customImage: draftCustomImage,
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

  const colorChoices: { value: MixtapeShellColor; label: string }[] = [
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

  const leftSpoolRadius = 40 - overallTapeProgress * 18;
  const rightSpoolRadius = 22 + overallTapeProgress * 18;

  // 4-digit mechanical tape counter
  const counterVal = isThisDeckActive
    ? String(Math.floor(activeIdx * 120 + currentTime) % 10000).padStart(4, '0')
    : '0000';

  const shellStyle = SHELL_THEMES[activeTape?.color || 'charcoal'];
  const normalizedModalQuery = modalSearch.normalize('NFC').trim().toLowerCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0">
      {/* LEFT: Stereo Cassette Deck Hardware */}
      <div className="lg:col-span-8 h-full min-h-0 rounded-2xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border-3 border-black dark:border-zinc-700 p-3.5 md:p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-zinc-100 flex flex-col justify-between overflow-hidden">
        {/* Top Brushed Faceplate: Model Badge + 4-Digit Mechanical Tape Counter */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isThisDeckActive && isPlaying ? 'bg-emerald-500' : 'bg-amber-500/70'
              }`}
            />
            <span className="text-[11px] font-black tracking-widest uppercase text-zinc-300">
              {t.csModelPlate}
            </span>
          </div>

          {/* 4-Digit Mechanical Odometer Counter */}
          <div className="flex items-center gap-1 bg-black px-2 py-0.5 rounded border-2 border-zinc-700 shadow-inner">
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
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
          {/* Hinged Smoked-Acrylic Cassette Well */}
          <div className="md:col-span-8 rounded-2xl bg-[#07080A] border-2 border-zinc-700 p-3 relative shadow-[inset_0_8px_22px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center overflow-hidden">
            <div
              className={`w-full max-w-[350px] transition-all duration-300 ${
                doorOpen ? 'scale-[1.02] -translate-y-0.5 drop-shadow-[0_14px_16px_rgba(0,0,0,0.9)]' : 'scale-100'
              }`}
            >
              {activeTape ? (
                /* Physical Compact Cassette Shell inside Door (Supports Colored Shell Patterns + Custom Cropped Artwork!) */
                <div
                  className={`rounded-xl bg-gradient-to-b ${shellStyle.body} border-2 ${shellStyle.border} p-2.5 shadow-xl relative overflow-hidden`}
                >
                  {/* Optional Full Custom Cropped Cassette Artwork Skin */}
                  {activeTape.customImage && (
                    <img
                      src={activeTape.customImage}
                      alt={activeTape.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none"
                      draggable={false}
                    />
                  )}

                  {/* Corner Shell Screws */}
                  <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-950/75 border border-white/25 z-10" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-950/75 border border-white/25 z-10" />
                  <span className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-950/75 border border-white/25 z-10" />
                  <span className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-950/75 border border-white/25 z-10" />

                  {/* Top Index Sticker with Colored Pattern Band */}
                  <div
                    className={`relative z-10 rounded-md overflow-hidden border border-black/30 shadow-xs ${
                      activeTape.customImage
                        ? 'bg-black/68 text-white backdrop-blur-[2px]'
                        : `${shellStyle.labelBg} ${shellStyle.labelText}`
                    }`}
                  >
                    {!activeTape.customImage && (
                      <div className="h-1.5 w-full" style={{ background: shellStyle.stripeCss }} />
                    )}
                    <div className="px-2.5 py-1">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider opacity-80">
                        <span>{t.csSideBadge}</span>
                        <span>
                          {isThisDeckActive
                            ? `${currentIndex + 1}/${activeTape.tracks.length}`
                            : `${activeTape.tracks.length} ${t.csTracksUnit}`}
                        </span>
                      </div>
                      <div className="text-xs font-black truncate mt-0.5">{activeTape.name}</div>
                    </div>
                  </div>

                  {/* Center Smoked Transparent Tape Spool Window */}
                  <div className="relative z-10 mt-2 mx-auto w-full h-22 rounded-lg bg-zinc-950/92 border-2 border-zinc-700/80 overflow-hidden flex items-center justify-center">
                    <svg viewBox="0 0 280 92" className="w-full h-full">
                      <circle cx="82" cy="46" r={leftSpoolRadius} fill="#291A14" stroke="#3F271E" strokeWidth="1.5" />
                      <circle cx="198" cy="46" r={rightSpoolRadius} fill="#291A14" stroke="#3F271E" strokeWidth="1.5" />

                      <rect x="116" y="32" width="48" height="28" rx="3" fill="#09090B" stroke="#3F3F46" strokeWidth="1" />
                      <line x1="122" y1="46" x2="158" y2="46" stroke="#71717A" strokeWidth="1" strokeDasharray="3 3" />

                      <g transform="translate(82, 46)">
                        <g ref={leftReelRef}>
                          <circle cx="0" cy="0" r="15" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
                          <circle cx="0" cy="0" r="8.5" fill="#09090B" />
                          {[0, 60, 120, 180, 240, 300].map((deg) => (
                            <rect
                              key={deg}
                              x="-2"
                              y="-14"
                              width="4"
                              height="5.5"
                              fill="#18181B"
                              transform={`rotate(${deg})`}
                            />
                          ))}
                        </g>
                      </g>

                      <g transform="translate(198, 46)">
                        <g ref={rightReelRef}>
                          <circle cx="0" cy="0" r="15" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
                          <circle cx="0" cy="0" r="8.5" fill="#09090B" />
                          {[0, 60, 120, 180, 240, 300].map((deg) => (
                            <rect
                              key={deg}
                              x="-2"
                              y="-14"
                              width="4"
                              height="5.5"
                              fill="#18181B"
                              transform={`rotate(${deg})`}
                            />
                          ))}
                        </g>
                      </g>
                    </svg>
                  </div>

                  {/* Bottom Trapezoid Head Shield */}
                  <div className="relative z-10 mt-2 mx-6 h-3.5 rounded-t-md bg-black/55 border-t border-x border-white/20 flex items-center justify-around px-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-2 h-2 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-2 h-2 rounded-full bg-zinc-950 border border-zinc-600" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 border border-zinc-600" />
                  </div>
                </div>
              ) : (
                /* Empty Metal Tape Head Mechanism Cage */
                <div className="h-40 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center p-4 text-center">
                  <div className="flex items-center gap-12 mb-2.5 opacity-45">
                    <span className="w-7 h-7 rounded-full border-2 border-zinc-400" />
                    <span className="w-7 h-7 rounded-full border-2 border-zinc-400" />
                  </div>
                  <p className="text-xs font-bold text-zinc-400">{t.csNoTapePrompt}</p>
                </div>
              )}
            </div>

            {/* Door Status Badge */}
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {doorOpen ? t.csDoorOpenStatus : t.csDoorClosedStatus}
            </div>
          </div>

          {/* Right Panel inside Deck: Dual Live Stereo Peak LED VU Meters + Volume Knob */}
          <div className="md:col-span-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 p-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex justify-between">
                <span>{t.csVuMeterTitle}</span>
                <span className="text-amber-400">{t.csVuUnit}</span>
              </div>

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
                              ? 'bg-red-500'
                              : 'bg-red-950/35'
                            : segIdx >= 7
                            ? isLit
                              ? 'bg-amber-400'
                              : 'bg-amber-950/35'
                            : isLit
                            ? 'bg-emerald-400'
                            : 'bg-emerald-950/35';
                        return <span key={segIdx} className={`h-2.5 rounded-[1px] transition-colors ${colorCls}`} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Track Readout + Quick View Tracklist Trigger */}
            <div className="my-1.5 p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] space-y-1">
              <div className="font-bold text-amber-300 truncate">
                {isThisDeckActive && currentTrack
                  ? currentTrack.title
                  : activeTape
                  ? activeTape.name
                  : '--'}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                <span>
                  {isThisDeckActive
                    ? `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`
                    : '00:00 / 00:00'}
                </span>
                {activeTape && (
                  <button
                    type="button"
                    onClick={() => {
                      mechanicalFoley.playClickWheelButton();
                      setRightPanelTab('tracklist');
                    }}
                    className="font-sans font-bold text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ListMusic className="w-3 h-3" />
                    <span>{t.csViewTracksBtn}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <RotaryKnob value={volume} onChange={setVolume} label={t.tvVolumeLabel} size={40} />
            </div>
          </div>
        </div>

        {/* MECHANICAL LATCHING PIANO-KEY TRANSPORT BAR */}
        <div className="mt-2.5 pt-2.5 border-t border-zinc-800 shrink-0">
          <div className="grid grid-cols-5 gap-2 bg-black p-1.5 rounded-xl border-2 border-zinc-800">
            <button
              type="button"
              disabled={!activeTape}
              onClick={handlePianoPlay}
              className={`py-2.5 px-2 rounded-lg border-2 border-black font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                isThisDeckActive && isPlaying
                  ? 'translate-y-[3px] bg-amber-400 text-black shadow-inner'
                  : 'bg-gradient-to-b from-zinc-200 to-zinc-400 text-zinc-950 shadow-[0_4px_0_0_#18181B] hover:from-white hover:to-zinc-300'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t.csKeyPlay}</span>
            </button>

            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoRew}
              className={`py-2.5 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                fastWindVisual === 'rew'
                  ? 'translate-y-[3px] bg-zinc-500 text-white shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_4px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <Rewind className="w-3.5 h-3.5" />
              <span>{t.csKeyRew}</span>
            </button>

            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoFf}
              className={`py-2.5 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                fastWindVisual === 'ff'
                  ? 'translate-y-[3px] bg-zinc-500 text-white shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_4px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{t.csKeyFf}</span>
            </button>

            <button
              type="button"
              disabled={!activeTape || !isThisDeckActive}
              onClick={handlePianoPause}
              className={`py-2.5 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                isThisDeckActive && !isPlaying && queue.length > 0
                  ? 'translate-y-[3px] bg-amber-500/80 text-black shadow-inner'
                  : 'bg-gradient-to-b from-zinc-700 to-zinc-800 text-zinc-100 shadow-[0_4px_0_0_#09090B] hover:from-zinc-600'
              }`}
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{t.csKeyPause}</span>
            </button>

            <button
              type="button"
              onClick={handlePianoStopEject}
              className="py-2.5 px-2 rounded-lg border-2 border-black font-bold text-xs flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_4px_0_0_#18181B] active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t.csKeyStopEject}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Cassette Mixtape Rack + Viewable Tape Tracklist Tabs */}
      <div className="lg:col-span-4 pencil-box bg-[var(--color-surface)] p-3.5 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Row: 2-Tab Switcher (Mixtape Rack | Tape Tracklist) + New Mixtape Button */}
        <div className="flex items-center justify-between gap-1.5 mb-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-xl border-2 border-[var(--color-border)] min-w-0">
            <button
              type="button"
              onClick={() => {
                mechanicalFoley.playClickWheelTick();
                setRightPanelTab('mixtapes');
              }}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer truncate ${
                rightPanelTab === 'mixtapes'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              {t.csTabMixtapes}
            </button>

            <button
              type="button"
              onClick={() => {
                mechanicalFoley.playClickWheelTick();
                setRightPanelTab('tracklist');
              }}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer truncate ${
                rightPanelTab === 'tracklist'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              {t.csTabTracklist}
              {activeTape ? ` (${activeTape.tracks.length})` : ''}
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-2.5 py-1.5 text-[11px] font-bold bg-[var(--color-accent)] text-[var(--color-bg)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer shrink-0"
            title={t.csNewMixtapeBtn}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{t.csNewMixtapeBtn}</span>
          </button>
        </div>

        {/* TAB 1: Visual Colored Cassette Mixtape Rack */}
        {rightPanelTab === 'mixtapes' ? (
          allResolvedMixtapes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
              {t.ttEmptyCrate}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {allResolvedMixtapes.map((tape) => {
                const isLoaded = activeTape?.id === tape.id && !doorOpen;

                return (
                  <div
                    key={tape.id}
                    onClick={() => handleLoadCassette(tape)}
                    className={`rounded-xl p-2 border-2 transition-all cursor-pointer ${
                      isLoaded
                        ? 'bg-zinc-900 border-[var(--color-accent)]'
                        : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Full Visual Colored / Custom-Artwork Miniature Cassette Shell */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <MiniCassettePreview
                          color={tape.color}
                          customImage={tape.customImage}
                          className="w-16 h-10"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs font-extrabold truncate ${
                              isLoaded ? 'text-amber-300' : 'text-[var(--color-text-main)]'
                            }`}
                          >
                            {tape.name}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
                            <span>
                              {tape.tracks.length} {t.csTracksUnit}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadCassette(tape, true);
                          }}
                          className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] cursor-pointer"
                          title={t.csViewTracksBtn}
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>

                        {!tape.isBuiltIn && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : /* TAB 2: Viewable Tracklist Inside Current Cassette */ !activeTape ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2 text-xs text-[var(--color-text-muted)]">
            <ListMusic className="w-8 h-8 opacity-40" />
            <p>{t.csNoTapeSelectedTracks}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Selected Cassette Header Strip */}
            <div className="mb-2 p-2 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center gap-2.5 shrink-0">
              <MiniCassettePreview
                color={activeTape.color}
                customImage={activeTape.customImage}
                className="w-14 h-9"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-amber-300 truncate">
                  {activeTape.name}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {activeTape.tracks.length} {t.csTracksUnit}
                </div>
              </div>
            </div>

            {/* Interactive Tracklist inside the Cassette */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {activeTape.tracks.map((track, idx) => {
                const isCurrentTrack =
                  isThisDeckActive &&
                  loadedMixtapeId === activeTape.id &&
                  currentIndex === idx;

                return (
                  <button
                    key={`${track.filePath}_${idx}`}
                    type="button"
                    onClick={() => handlePlaySpecificTrackInTape(activeTape, idx)}
                    className={`w-full text-left p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2.5 ${
                      isCurrentTrack
                        ? 'bg-zinc-900 border-[var(--color-accent)] text-amber-300'
                        : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-main)]'
                    }`}
                  >
                    <span className="text-[10px] font-mono opacity-65 w-4 shrink-0">
                      {String(idx + 1).padStart(2, '0')}
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

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate" title={track.title}>
                        {track.title}
                      </div>
                      <div className="text-[10px] opacity-65">{track.fileSizeStr}</div>
                    </div>

                    {isCurrentTrack && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black/40 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom Mixtape Creator / Editor Modal (Visual Colored Cassette Patterns + Custom Image Upload & International Cropper!) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="pencil-box w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[var(--color-surface)] border-2 border-[var(--color-border)] p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
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

            {/* Mixtape Name Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--color-text-muted)] block">
                {t.csModalNameLabel}
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t.csModalNamePlaceholder}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] select-text"
              />
            </div>

            {/* Visual Colored Cassette Pattern Selector (6 Direct Visual Cassette Designs) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--color-text-muted)] block">
                {t.csModalColorLabel}
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {colorChoices.map((opt) => {
                  const selected = draftColor === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        mechanicalFoley.playClickWheelTick();
                        setDraftColor(opt.value);
                      }}
                      className={`p-1.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        selected
                          ? 'bg-[var(--color-bg)] border-[var(--color-accent)] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                          : 'bg-[var(--color-bg)]/60 border-[var(--color-border)] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <MiniCassettePreview color={opt.value} className="w-full h-9" />
                      <span className="text-[9px] font-bold text-[var(--color-text-main)] truncate w-full text-center">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Cassette Image Upload & International-Standard Cropper Trigger */}
            <div className="space-y-1.5 bg-[var(--color-bg)] p-2.5 rounded-xl border-2 border-[var(--color-border)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <MiniCassettePreview
                    color={draftColor}
                    customImage={draftCustomImage}
                    className="w-16 h-10"
                  />
                  <div>
                    <div className="text-[11px] font-extrabold text-[var(--color-text-main)]">
                      {t.csCustomImageLabel}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectImageFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      mechanicalFoley.playClickWheelButton();
                      fileInputRef.current?.click();
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-[var(--color-surface)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{t.csUploadImageBtn}</span>
                  </button>

                  {draftCustomImage && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          mechanicalFoley.playClickWheelButton();
                          setRawImageForCropper(rawImageForCropper || draftCustomImage);
                          setIsCropperOpen(true);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold bg-[var(--color-accent)] text-[var(--color-bg)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>{t.csEditCropBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          mechanicalFoley.playClickWheelButton();
                          setDraftCustomImage(undefined);
                          setRawImageForCropper(null);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold bg-red-500/90 text-white border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.csRemoveImageBtn}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Track Selection List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[var(--color-text-muted)]">
                  {t.csModalSelectTracks} ({draftTrackPaths.length})
                </label>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder={t.playerSearchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] select-text"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 border-2 border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg)]">
                {audioItems
                  .filter((a) => {
                    if (!normalizedModalQuery) return true;
                    const tNorm = (a.title || '').normalize('NFC').toLowerCase();
                    const fNorm = (a.filePath.split(/[/\\]/).pop() || '')
                      .normalize('NFC')
                      .toLowerCase();
                    return tNorm.includes(normalizedModalQuery) || fNorm.includes(normalizedModalQuery);
                  })
                  .map((track) => {
                    const checked = draftTrackPaths.includes(track.filePath);
                    return (
                      <button
                        key={track.filePath}
                        type="button"
                        onClick={() => toggleDraftTrack(track.filePath)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 border cursor-pointer transition-colors ${
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

            <div className="flex justify-end gap-2 pt-1">
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

      {/* International-Standard Interactive Image Cropper Modal */}
      {isCropperOpen && rawImageForCropper && (
        <ImageCropperModal
          language={language}
          imageSrc={rawImageForCropper}
          initialAspect={1.68}
          onApply={(croppedUrl) => {
            setDraftCustomImage(croppedUrl);
            setIsCropperOpen(false);
          }}
          onCancel={() => {
            setIsCropperOpen(false);
          }}
        />
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
