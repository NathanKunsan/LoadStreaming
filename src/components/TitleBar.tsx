import React from 'react';
import { Minus, Square, X, RefreshCw, Settings } from 'lucide-react';
import { ThaiFlag, UkFlag } from './SvgFlags';
import { Language, translations } from '../locales/translations';
import { AppConfig } from '../../electron/types';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';
import appLogo from '../assets/icon.png';

interface TitleBarProps {
  config: AppConfig;
  onThemeChange: (theme: AppConfig['theme']) => void;
  onLanguageChange: (lang: Language) => void;
  onCheckUpdate: () => void;
  isCheckingUpdate: boolean;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  config,
  onThemeChange,
  onLanguageChange,
  onCheckUpdate,
  isCheckingUpdate,
  onOpenSettings,
  onClose
}) => {
  const t = translations[config.language];

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.electronAPI?.close();
    }
  };

  const themeOptions: NeoDropdownOption<AppConfig['theme']>[] = [
    { value: 'yellow-black', label: t.themeYellowBlack },
    { value: 'white-black', label: t.themeWhiteBlack },
    { value: 'white-blue', label: t.themeWhiteBlue },
    { value: 'black-blue', label: t.themeBlackBlue },
  ];

  return (
    <header className="app-drag-region h-11 w-full flex items-center justify-between px-3 border-b-2 border-[var(--color-border)] bg-[var(--color-bg)] select-none text-[var(--color-text-main)] z-50">
      {/* Brand / Logo with bundled transparent icon (no version number) */}
      <div className="flex items-center space-x-2">
        <img
          src={appLogo}
          alt="LoadStreaming Logo"
          className="w-6 h-6 rounded-md shadow-xs object-contain shrink-0"
        />
        <span className="font-bold text-sm tracking-wide">LoadStreaming</span>
      </div>

      {/* Controls: Theme, Language, Updates, Settings, Window buttons */}
      <div className="app-no-drag flex items-center space-x-2">
        {/* Theme Selector NeoDropdown */}
        <div className="w-36">
          <NeoDropdown
            value={config.theme}
            onChange={(val) => onThemeChange(val as AppConfig['theme'])}
            options={themeOptions}
            size="sm"
            buttonClassName="h-7 text-xs border border-[var(--color-border)]"
            dropdownClassName="w-40"
          />
        </div>

        {/* Language Selector with Vector SVG Flags */}
        <div className="flex items-center space-x-1 border border-[var(--color-border)] p-0.5 rounded bg-[var(--color-surface)]">
          <button
            type="button"
            onClick={() => onLanguageChange('th')}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs transition-all cursor-pointer ${
              config.language === 'th'
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
            }`}
            title="ภาษาไทย (Thai)"
          >
            <ThaiFlag className="w-4 h-2.5" />
            <span>TH</span>
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs transition-all cursor-pointer ${
              config.language === 'en'
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
            }`}
            title="English"
          >
            <UkFlag className="w-4 h-2.5" />
            <span>EN</span>
          </button>
        </div>

        {/* Check Update Button */}
        <button
          type="button"
          onClick={onCheckUpdate}
          disabled={isCheckingUpdate}
          className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
          title={t.checkUpdateBtn}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
        </button>

        {/* Settings Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
            title={t.settingsTitle}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Window controls */}
        <div className="flex items-center ml-2 border-l border-[var(--color-border)] pl-1">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center hover:bg-[var(--color-surface-hover)] rounded transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center hover:bg-[var(--color-surface-hover)] rounded transition-colors cursor-pointer"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center hover:bg-red-600 hover:text-white rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
