import React from 'react';
import { Play, Pause, SkipForward, Square, Disc3, CassetteTape, Smartphone } from 'lucide-react';
import { PlayerCategory } from '../../electron/types';
import { translations, Language } from '../locales/translations';
import { useAudioDeck } from '../contexts/AudioDeckContext';
import { mechanicalFoley } from '../utils/mechanicalFoley';
import { formatMediaTime } from '../utils/mediaHelpers';

interface MiniAudioBarProps {
  language: Language;
  visible: boolean;
  onJumpToPlayer: (category: PlayerCategory) => void;
}

export const MiniAudioBar: React.FC<MiniAudioBarProps> = ({
  language,
  visible,
  onJumpToPlayer
}) => {
  const t = translations[language];
  const {
    activeMachine,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playAudio,
    pauseAudio,
    nextTrack,
    stopAndUnloadAudio,
    queue
  } = useAudioDeck();

  if (!visible || !activeMachine || !currentTrack) return null;

  const machineLabel =
    activeMachine === 'turntable'
      ? t.miniPlayingFromTurntable
      : activeMachine === 'cassette'
      ? t.miniPlayingFromCassette
      : t.miniPlayingFromPortable;

  return (
    <div className="shrink-0 border-t-2 border-[var(--color-border)] bg-[var(--color-surface)] px-4 md:px-6 py-2.5 z-30">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Active Machine Icon + Track Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border-2 border-black text-amber-400 flex items-center justify-center shrink-0">
            {activeMachine === 'turntable' ? (
              <Disc3 className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} />
            ) : activeMachine === 'cassette' ? (
              <CassetteTape className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-accent)]">
              {machineLabel} • {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
            </div>
            <div className="text-xs font-bold truncate text-[var(--color-text-main)]">
              {currentTrack.title}
            </div>
          </div>
        </div>

        {/* Transport & Jump Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              mechanicalFoley.playClickWheelButton();
              if (isPlaying) pauseAudio();
              else playAudio();
            }}
            className="p-2 bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {queue.length > 1 && (
            <button
              type="button"
              onClick={() => {
                mechanicalFoley.playClickWheelButton();
                nextTrack();
              }}
              className="p-2 bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              mechanicalFoley.playPianoKeyRelease();
              stopAndUnloadAudio();
            }}
            className="p-2 bg-red-500/90 text-white border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
            title={t.miniStopBtn}
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              mechanicalFoley.playClickWheelButton();
              onJumpToPlayer(activeMachine);
            }}
            className="px-3 py-1.5 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-bg)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            {t.miniOpenPlayerBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
