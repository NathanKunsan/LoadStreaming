import React, { useState, useEffect } from 'react';
import { Tv, Disc3, CassetteTape, Smartphone, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { PlayerCategory, MediaLibraryItem } from '../../electron/types';
import { translations, Language } from '../locales/translations';
import { useAudioDeck } from '../contexts/AudioDeckContext';
import { mechanicalFoley } from '../utils/mechanicalFoley';
import { CrtTvPlayer } from './player/CrtTvPlayer';
import { TurntablePlayer } from './player/TurntablePlayer';
import { CassetteDeckPlayer } from './player/CassetteDeckPlayer';
import { PortableWheelPlayer } from './player/PortableWheelPlayer';

interface MediaPlayerSectionProps {
  language: Language;
  sfxMuted: boolean;
  onToggleSfxMute: () => void;
  forcedCategory?: PlayerCategory | null;
  onCategoryChange?: (cat: PlayerCategory) => void;
}

export const MediaPlayerSection: React.FC<MediaPlayerSectionProps> = ({
  language,
  sfxMuted,
  onToggleSfxMute,
  forcedCategory,
  onCategoryChange
}) => {
  const t = translations[language];
  const { refreshLibrary, pendingLaunch, clearPendingLaunch, activeMachine } = useAudioDeck();

  const [category, setCategory] = useState<PlayerCategory>(() => {
    if (forcedCategory) return forcedCategory;
    if (activeMachine) return activeMachine;
    return 'tv';
  });
  const [launchItem, setLaunchItem] = useState<MediaLibraryItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (forcedCategory) {
      setCategory(forcedCategory);
    }
  }, [forcedCategory]);

  useEffect(() => {
    if (pendingLaunch) {
      setCategory(pendingLaunch.category);
      onCategoryChange?.(pendingLaunch.category);
      setLaunchItem(pendingLaunch.item);
      clearPendingLaunch();
    }
  }, [clearPendingLaunch, onCategoryChange, pendingLaunch]);

  const handleSelectCategory = (nextCat: PlayerCategory) => {
    if (nextCat === category) return;
    mechanicalFoley.playClickWheelButton();
    setCategory(nextCat);
    onCategoryChange?.(nextCat);
  };

  const handleRescan = async () => {
    mechanicalFoley.playClickWheelButton();
    setIsRefreshing(true);
    await refreshLibrary();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const categories: {
    id: PlayerCategory;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isRunning?: boolean;
  }[] = [
    {
      id: 'tv',
      title: t.playerCatTv,
      subtitle: t.playerCatTvSub,
      icon: <Tv className="w-4 h-4" />
    },
    {
      id: 'turntable',
      title: t.playerCatTurntable,
      subtitle: t.playerCatTurntableSub,
      icon: <Disc3 className="w-4 h-4" />,
      isRunning: activeMachine === 'turntable'
    },
    {
      id: 'cassette',
      title: t.playerCatCassette,
      subtitle: t.playerCatCassetteSub,
      icon: <CassetteTape className="w-4 h-4" />,
      isRunning: activeMachine === 'cassette'
    },
    {
      id: 'portable',
      title: t.playerCatPortable,
      subtitle: t.playerCatPortableSub,
      icon: <Smartphone className="w-4 h-4" />,
      isRunning: activeMachine === 'portable'
    }
  ];

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5">
      {/* Top Category Selector Bar (4 Separate Standalone Player Categories) + Hardware SFX Switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          {categories.map((cat) => {
            const selected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-2.5 py-2 text-left border-2 border-black dark:border-white rounded-xl sketch-btn transition-all cursor-pointer flex items-center gap-2 relative ${
                  selected
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-main)] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:border-[var(--color-accent)]'
                }`}
              >
                <div className="shrink-0">{cat.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">{cat.title}</div>
                  <div className="text-[10px] opacity-80 truncate">{cat.subtitle}</div>
                </div>
                {cat.isRunning && (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 border border-black/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* Mechanical Foley Sound Switch & Shelf Rescan */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={onToggleSfxMute}
            className={`px-3 py-1.5 text-xs font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer ${
              sfxMuted
                ? 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-main)]'
            }`}
            title={sfxMuted ? t.playerSfxOff : t.playerSfxOn}
          >
            {sfxMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{sfxMuted ? t.playerSfxOff : t.playerSfxOn}</span>
          </button>

          <button
            type="button"
            onClick={handleRescan}
            className="p-1.5 text-xs font-bold bg-[var(--color-surface)] text-[var(--color-text-main)] border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
            title={t.playerRescanBtn}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Standalone Hardware Machine Viewport */}
      <div className="flex-1 min-h-0">
        {category === 'tv' && (
          <CrtTvPlayer
            language={language}
            initialLaunchItem={launchItem}
            onConsumedLaunch={() => setLaunchItem(null)}
          />
        )}
        {category === 'turntable' && (
          <TurntablePlayer
            language={language}
            initialLaunchItem={launchItem}
            onConsumedLaunch={() => setLaunchItem(null)}
          />
        )}
        {category === 'cassette' && <CassetteDeckPlayer language={language} />}
        {category === 'portable' && <PortableWheelPlayer language={language} />}
      </div>
    </div>
  );
};
