import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Power,
  Maximize2,
  Minimize2,
  Search,
  Tv,
  ArrowUpFromLine
} from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { toLocalMediaUrl, formatMediaTime } from '../../utils/mediaHelpers';
import { RotaryKnob } from './RotaryKnob';
import { MediaThumb } from './MediaThumb';

interface CrtTvPlayerProps {
  language: Language;
  initialLaunchItem?: MediaLibraryItem | null;
  onConsumedLaunch?: () => void;
}

export const CrtTvPlayer: React.FC<CrtTvPlayerProps> = ({
  language,
  initialLaunchItem,
  onConsumedLaunch
}) => {
  const t = translations[language];
  const { videoItems, verifyMediaFile, pauseAudio, isPlaying: isAudioDeckPlaying } = useAudioDeck();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const crtViewportRef = useRef<HTMLDivElement | null>(null);

  const [loadedCartridge, setLoadedCartridge] = useState<MediaLibraryItem | null>(null);
  const [slotAnimState, setSlotAnimState] = useState<'idle' | 'inserting' | 'loaded' | 'ejecting'>('idle');
  const [animatingTitle, setAnimatingTitle] = useState<string>('');
  const [tubePowered, setTubePowered] = useState<boolean>(true);
  const [tubeBeamAnim, setTubeBeamAnim] = useState<'on' | 'igniting' | 'collapsing' | 'off'>('on');
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const insertCartridge = useCallback(
    async (item: MediaLibraryItem) => {
      if (slotAnimState === 'inserting' || slotAnimState === 'ejecting') return;
      if (loadedCartridge?.filePath === item.filePath && slotAnimState === 'loaded') return;

      const exists = await verifyMediaFile(item);
      if (!exists) return;

      // Pause background MP3 deck if running so audio never clashes
      if (isAudioDeckPlaying) {
        pauseAudio();
      }

      // If another cartridge is currently inside, run crisp mechanical eject first
      if (loadedCartridge) {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setIsPlaying(false);
        setAnimatingTitle(loadedCartridge.title);
        setSlotAnimState('ejecting');
        mechanicalFoley.playCartridgeEject();
        await new Promise((r) => setTimeout(r, 280));
        setLoadedCartridge(null);
      }

      setAnimatingTitle(item.title);
      setSlotAnimState('inserting');
      mechanicalFoley.playCartridgeInsert();

      await new Promise((r) => setTimeout(r, 340));

      setLoadedCartridge(item);
      setSlotAnimState('loaded');
      setCurrentTime(0);
      setDuration(0);

      // Ignite CRT electron beam if tube was off
      if (!tubePowered) {
        setTubePowered(true);
        setTubeBeamAnim('igniting');
        mechanicalFoley.playCrtTurnOn();
        setTimeout(() => {
          setTubeBeamAnim('on');
        }, 320);
      } else {
        setTubeBeamAnim('on');
      }
    },
    [isAudioDeckPlaying, loadedCartridge, pauseAudio, slotAnimState, tubePowered, verifyMediaFile]
  );

  // Auto-load item if launched from HistorySection
  useEffect(() => {
    if (initialLaunchItem && initialLaunchItem.mediaType === 'video') {
      insertCartridge(initialLaunchItem);
      onConsumedLaunch?.();
    }
  }, [initialLaunchItem, insertCartridge, onConsumedLaunch]);

  // Start playback automatically once loadedCartridge binds to <video>
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !loadedCartridge || slotAnimState !== 'loaded') return;
    vid.volume = volume;
    if (tubePowered) {
      vid
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [loadedCartridge, slotAnimState]);

  const handleTogglePower = () => {
    if (tubePowered) {
      mechanicalFoley.playCrtTurnOff();
      setTubeBeamAnim('collapsing');
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setTimeout(() => {
        setTubePowered(false);
        setTubeBeamAnim('off');
      }, 260);
    } else {
      mechanicalFoley.playCrtTurnOn();
      setTubePowered(true);
      setTubeBeamAnim('igniting');
      setTimeout(() => {
        setTubeBeamAnim('on');
        if (loadedCartridge && videoRef.current) {
          if (isAudioDeckPlaying) pauseAudio();
          videoRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        }
      }, 320);
    }
  };

  const handlePlayPause = async () => {
    mechanicalFoley.playPianoKeyLatch();
    if (!loadedCartridge || !videoRef.current) return;
    if (!tubePowered) {
      handleTogglePower();
      return;
    }
    const exists = await verifyMediaFile(loadedCartridge);
    if (!exists) {
      setLoadedCartridge(null);
      setSlotAnimState('idle');
      return;
    }
    if (videoRef.current.paused) {
      if (isAudioDeckPlaying) pauseAudio();
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeekOffset = (deltaSec: number) => {
    mechanicalFoley.playTapeFastWind();
    const vid = videoRef.current;
    if (!vid || !loadedCartridge) return;
    const target = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + deltaSec));
    vid.currentTime = target;
    setCurrentTime(target);
  };

  const handleEject = () => {
    if (!loadedCartridge || slotAnimState === 'ejecting' || slotAnimState === 'inserting') return;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAnimatingTitle(loadedCartridge.title);
    setLoadedCartridge(null);
    setSlotAnimState('ejecting');
    mechanicalFoley.playCartridgeEject();

    setTimeout(() => {
      setSlotAnimState('idle');
      setAnimatingTitle('');
    }, 300);
  };

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    if (videoRef.current) {
      videoRef.current.volume = nextVol;
    }
  };

  const handleToggleFullscreen = () => {
    mechanicalFoley.playClickWheelButton();
    if (!crtViewportRef.current) return;
    if (!document.fullscreenElement) {
      crtViewportRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const normalizedQuery = searchQuery.normalize('NFC').trim().toLowerCase();
  const filteredVideos = videoItems.filter((v) => {
    if (!normalizedQuery) return true;
    const titleNorm = (v.title || '').normalize('NFC').toLowerCase();
    const fileNorm = (v.filePath.split(/[/\\]/).pop() || '').normalize('NFC').toLowerCase();
    return titleNorm.includes(normalizedQuery) || fileNorm.includes(normalizedQuery);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0">
      {/* LEFT: Realistic CRT Television + Integrated Video Cartridge Deck */}
      <div className="lg:col-span-8 h-full min-h-0 rounded-2xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border-3 border-black dark:border-zinc-700 p-3.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-zinc-100 flex flex-col justify-between overflow-hidden">
        {/* Top Cabinet Ventilation Louvers & Model Plate */}
        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-black/60 transition-colors ${
                tubePowered ? 'bg-emerald-500' : 'bg-red-500/80'
              }`}
            />
            <span className="text-[11px] font-black tracking-widest uppercase text-zinc-300">
              {t.tvModelPlate}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <span key={idx} className="w-3 h-1 rounded-full bg-zinc-950 border-b border-zinc-700/50" />
            ))}
          </div>
        </div>

        {/* Recessed Molded CRT Screen Bezel (Flexibly scales inside viewport height without forcing page scroll) */}
        <div className="flex-1 min-h-0 p-2 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-[inset_0_6px_18px_rgba(0,0,0,0.95)] flex items-center justify-center overflow-hidden">
          <div
            ref={crtViewportRef}
            className="relative h-full max-h-full aspect-video max-w-full rounded-[16px] bg-[#0B0D0E] overflow-hidden border-2 border-zinc-900 shadow-[inset_0_0_40px_rgba(0,0,0,0.95)] flex items-center justify-center group"
          >
            {/* CRT Electron Tube Content Layer */}
            <div
              className="w-full h-full relative flex items-center justify-center transition-all duration-300"
              style={{
                transform:
                  tubeBeamAnim === 'igniting'
                    ? 'scaleY(0.02) scaleX(1.02)'
                    : tubeBeamAnim === 'collapsing'
                    ? 'scaleY(0.012) scaleX(0.35)'
                    : tubeBeamAnim === 'off'
                    ? 'scaleY(0) scaleX(0)'
                    : 'scaleY(1) scaleX(1)',
                filter:
                  tubeBeamAnim === 'igniting' || tubeBeamAnim === 'collapsing'
                    ? 'brightness(4) contrast(2)'
                    : 'none'
              }}
            >
              {loadedCartridge && slotAnimState === 'loaded' ? (
                <video
                  ref={videoRef}
                  src={toLocalMediaUrl(loadedCartridge.filePath)}
                  className="w-full h-full object-contain bg-black"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration || 0);
                    e.currentTarget.volume = volume;
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={handlePlayPause}
                />
              ) : (
                /* No Cartridge Inserted Standby Phosphor Screen */
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-5 bg-[radial-gradient(circle_at_center,#182026_0%,#090B0D_100%)] relative">
                  <div className="absolute top-2.5 right-3.5 text-[10px] font-mono font-bold text-emerald-400/90 tracking-widest">
                    {t.tvChannelBadge}
                  </div>
                  <Tv className="w-10 h-10 text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-zinc-400 max-w-xs leading-relaxed">
                    {t.tvInsertPrompt}
                  </p>
                </div>
              )}
            </div>

            {/* Tube Standby Message when powered off */}
            {!tubePowered && (
              <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                <p className="text-[11px] font-semibold text-zinc-600 text-center">
                  {t.tvStandbyScreen}
                </p>
              </div>
            )}

            {/* Authentic CRT Scanline, Aperture Grille & Curved Glass Specular Reflection */}
            {scanlinesEnabled && tubePowered && (
              <div
                className="pointer-events-none absolute inset-0 z-10 opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)'
                }}
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 z-10 rounded-[16px]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 28%, transparent 50%, rgba(0,0,0,0.38) 100%)',
                boxShadow: 'inset 0 0 28px rgba(0,0,0,0.85)'
              }}
            />

            {/* Fullscreen Floating Exit Pill */}
            {isFullscreen && (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-lg bg-black/75 border border-zinc-600 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{t.tvExitFullscreenBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Deck Controls Block (shrink-0) */}
        <div className="mt-2.5 space-y-2 shrink-0">
          {/* INTEGRATED PHYSICAL VIDEO CARTRIDGE SLOT + VFD COUNTER */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-zinc-950/90 p-2 rounded-xl border-2 border-zinc-800">
            {/* Front-Loading Cartridge Mouth */}
            <div className="md:col-span-7 relative">
              <div className="h-10 rounded-lg bg-[#070709] border-2 border-zinc-700 shadow-[inset_0_4px_10px_rgba(0,0,0,1)] relative overflow-hidden flex items-center justify-center px-3">
                {/* Spring Dust Flap */}
                <div
                  className={`w-full h-6 rounded bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/80 flex items-center justify-between px-2.5 transition-all duration-200 ${
                    slotAnimState === 'loaded'
                      ? 'translate-y-0 border-amber-500/40'
                      : slotAnimState === 'inserting'
                      ? 'scale-95 opacity-60'
                      : ''
                  }`}
                >
                  <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 truncate pr-2">
                    {loadedCartridge
                      ? loadedCartridge.title
                      : slotAnimState === 'inserting' || slotAnimState === 'ejecting'
                      ? animatingTitle
                      : t.tvSlotEmpty}
                  </span>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                      loadedCartridge
                        ? 'bg-amber-400 text-black'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}
                  >
                    {loadedCartridge ? t.tvSlotOccupied : t.tvSlotBadgeIdle}
                  </span>
                </div>

                {/* Animated Physical Cartridge Sliding In / Popping Out */}
                {(slotAnimState === 'inserting' || slotAnimState === 'ejecting') && (
                  <div
                    className={`absolute inset-x-4 h-7 rounded bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-2 border-black flex items-center justify-center px-3 shadow-lg transition-transform duration-200 ${
                      slotAnimState === 'inserting'
                        ? 'scale-95 translate-y-0'
                        : 'scale-100 translate-y-0.5'
                    }`}
                  >
                    <span className="text-[10px] font-black text-black truncate">
                      {animatingTitle}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Vacuum Fluorescent Display (VFD) Time Counter */}
            <div className="md:col-span-5 h-10 rounded-lg bg-[#050B0A] border-2 border-zinc-800 px-3 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlaying ? 'bg-emerald-500' : 'bg-emerald-950'
                  }`}
                />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-500/80">
                  {isPlaying ? t.tvPlayBtn : t.tvPauseBtn}
                </span>
              </div>
              <div className="font-mono text-xs font-bold tracking-widest text-emerald-300">
                {formatMediaTime(currentTime)} <span className="text-emerald-700">/</span>{' '}
                {formatMediaTime(duration)}
              </div>
            </div>
          </div>

          {/* Timeline Scrubber Rail */}
          <div className="px-1">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={loadedCartridge ? currentTime : 0}
              disabled={!loadedCartridge || duration <= 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                if (videoRef.current) {
                  videoRef.current.currentTime = val;
                }
              }}
              className="w-full accent-amber-400 h-1.5 bg-zinc-950 rounded-lg cursor-pointer disabled:opacity-40 block"
            />
          </div>

          {/* Physical Beveled Control Panel + Rotary Volume Knob */}
          <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            {/* Mechanical Push-Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePower}
                className={`px-2.5 py-1.5 text-xs font-bold border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer transition-all ${
                  tubePowered
                    ? 'bg-zinc-700 text-emerald-300 hover:bg-zinc-600'
                    : 'bg-red-600 text-white hover:bg-red-500'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{t.tvPowerBtn}</span>
              </button>

              <button
                type="button"
                disabled={!loadedCartridge}
                onClick={() => handleSeekOffset(-10)}
                className="px-2.5 py-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                title={t.tvRewindBtn}
              >
                <Rewind className="w-3.5 h-3.5" />
                <span>{t.tvRewindBtn}</span>
              </button>

              <button
                type="button"
                disabled={!loadedCartridge}
                onClick={handlePlayPause}
                className={`px-3.5 py-1.5 text-xs font-extrabold border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                  isPlaying
                    ? 'bg-amber-400 text-black translate-y-[1px]'
                    : 'bg-zinc-200 text-zinc-950 hover:bg-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? t.tvPauseBtn : t.tvPlayBtn}</span>
              </button>

              <button
                type="button"
                disabled={!loadedCartridge}
                onClick={() => handleSeekOffset(10)}
                className="px-2.5 py-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
                title={t.tvForwardBtn}
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>{t.tvForwardBtn}</span>
              </button>

              <button
                type="button"
                disabled={!loadedCartridge}
                onClick={handleEject}
                className="px-2.5 py-1.5 text-xs font-bold bg-red-500/90 hover:bg-red-500 disabled:opacity-40 text-white border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 cursor-pointer"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span>{t.tvEjectBtn}</span>
              </button>
            </div>

            {/* Right Auxiliary Controls: Scanline Switch, Fullscreen, Rotary Volume Dial */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  setScanlinesEnabled((s) => !s);
                }}
                className={`px-2.5 py-1.5 text-[11px] font-bold border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
                  scanlinesEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {t.tvScanlineBtn}
              </button>

              <button
                type="button"
                disabled={!loadedCartridge}
                onClick={handleToggleFullscreen}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                title={t.tvFullscreenBtn}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <RotaryKnob
                value={volume}
                onChange={handleVolumeChange}
                label={t.tvVolumeLabel}
                size={38}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Physical Video Cartridge Storage Rack */}
      <div className="lg:col-span-4 pencil-box bg-[var(--color-surface)] p-3.5 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)]">
            {t.tvCartridgeShelfTitle} ({filteredVideos.length})
          </h3>
        </div>

        {/* Search Input */}
        <div className="relative mb-2.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.playerSearchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] select-text"
          />
        </div>

        {/* Cartridge Slots List */}
        {filteredVideos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.tvEmptyShelf}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filteredVideos.map((item) => {
              const isInserted = loadedCartridge?.filePath === item.filePath;

              return (
                <button
                  key={item.filePath}
                  type="button"
                  onClick={() => insertCartridge(item)}
                  className={`w-full text-left rounded-xl p-2 border-2 transition-all cursor-pointer relative overflow-hidden group ${
                    isInserted
                      ? 'bg-zinc-900 border-[var(--color-accent)] translate-x-0.5 shadow-inner'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-black dark:border-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {/* Molded Top Cartridge Grip Ribs */}
                  <div className="flex items-center gap-1 mb-1.5 opacity-50">
                    <span className="h-1 flex-1 rounded-full bg-zinc-700" />
                    <span className="h-1 flex-1 rounded-full bg-zinc-700" />
                    <span className="h-1 flex-1 rounded-full bg-zinc-700" />
                  </div>

                  {/* Recessed Cartridge Label Sticker */}
                  <div className="flex items-center gap-2.5 bg-zinc-950 rounded-lg p-1.5 border border-zinc-700/80">
                    <div className="w-16 h-10 rounded overflow-hidden shrink-0 border border-zinc-700 relative">
                      <MediaThumb
                        src={item.thumbnail}
                        filePath={item.filePath}
                        title={item.title}
                        mediaType="video"
                        className="w-full h-full"
                      />
                      <span className="absolute bottom-0 right-0 px-1 text-[8px] font-black bg-black/85 text-amber-300">
                        {item.resolution && item.resolution !== 'MP4' ? item.resolution : t.tvFormatFallback}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-zinc-100 truncate" title={item.title}>
                        {item.title}
                      </div>
                      <div className="flex items-center justify-between mt-0.5 text-[10px] text-zinc-400">
                        <span>{item.fileSizeStr}</span>
                        {isInserted && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black font-black text-[9px]">
                            {t.tvSlotOccupied}
                          </span>
                        )}
                      </div>
                    </div>
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
