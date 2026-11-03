import React, { useState } from 'react';
import { Settings, X, Save, Keyboard, Compass, Link2 } from 'lucide-react';
import { translations, Language } from '../locales/translations';
import { AppConfig } from '../../electron/types';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';

interface SettingsModalProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  language,
  isOpen,
  onClose,
  config,
  onSaveConfig
}) => {
  if (!isOpen) return null;

  const t = translations[language];

  const [enableClipboard, setEnableClipboard] = useState(config.enableClipboardMonitor !== false);
  const [enableRadial, setEnableRadial] = useState(config.enableRadialMenu !== false);
  const [shortcut, setShortcut] = useState(config.radialShortcut || 'Alt+Q');
  const [isRecording, setIsRecording] = useState(false);

  const [northAct, setNorthAct] = useState(config.radialActions?.north || 'actDownloadVideo');
  const [eastAct, setEastAct] = useState(config.radialActions?.east || 'actDownloadAudio');
  const [southAct, setSouthAct] = useState(config.radialActions?.south || 'actOpenFolder');
  const [westAct, setWestAct] = useState(config.radialActions?.west || 'actOpenConvert');

  const actionOptions: NeoDropdownOption<string>[] = [
    { value: 'actDownloadVideo', label: t.actDownloadVideo },
    { value: 'actDownloadAudio', label: t.actDownloadAudio },
    { value: 'actOpenFolder', label: t.actOpenFolder },
    { value: 'actOpenConvert', label: t.actOpenConvert },
    { value: 'actToggleApp', label: t.actToggleApp }
  ];

  const handleKeyDownRecord = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');

    const key = e.key.toUpperCase();
    if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
      parts.push(key);
      if (parts.length > 1) {
        setShortcut(parts.join('+'));
        setIsRecording(false);
      }
    }
  };

  const handleSave = () => {
    onSaveConfig({
      enableClipboardMonitor: enableClipboard,
      enableRadialMenu: enableRadial,
      radialShortcut: shortcut,
      radialActions: {
        north: northAct,
        east: eastAct,
        south: southAct,
        west: westAct
      }
    });

    if (window.electronAPI) {
      window.electronAPI.registerRadialShortcut(shortcut);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="pencil-box max-w-lg w-full p-5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm">{t.settingsTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="space-y-4 text-xs">
          {/* Clipboard Monitor Toggle */}
          <div className="flex items-center justify-between p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
            <div className="flex items-center space-x-2">
              <Link2 className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="font-bold">{t.enableClipboardMonitorLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setEnableClipboard(!enableClipboard)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                enableClipboard ? 'bg-[var(--color-accent)] justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-black shadow-md" />
            </button>
          </div>

          {/* Quick Radial Menu Settings */}
          <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="font-bold">{t.enableRadialMenuLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableRadial(!enableRadial)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  enableRadial ? 'bg-[var(--color-accent)] justify-end' : 'bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow-md" />
              </button>
            </div>

            {enableRadial && (
              <div className="space-y-3 pt-2 border-t border-[var(--color-border)]/50">
                {/* Hotkey recorder */}
                <div>
                  <label className="block text-[11px] font-bold mb-1 text-[var(--color-text-muted)] flex items-center space-x-1">
                    <Keyboard className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>{t.radialShortcutLabel}</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={isRecording ? t.pressKeysToRecord : shortcut}
                      onKeyDown={isRecording ? handleKeyDownRecord : undefined}
                      className={`flex-1 h-8 px-2.5 text-xs font-mono font-bold rounded border-2 outline-none text-[var(--color-text-main)] ${
                        isRecording
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 animate-pulse'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setIsRecording(!isRecording)}
                      className="pencil-button-secondary px-3 text-xs font-semibold cursor-pointer"
                    >
                      {isRecording ? t.cancelBtn : (language === 'th' ? 'เปลี่ยนปุ่ม' : 'Change Key')}
                    </button>
                  </div>
                </div>

                {/* Slices config using NeoDropdown */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">
                      {t.radialActionNorth}
                    </label>
                    <NeoDropdown
                      value={northAct}
                      onChange={(val) => setNorthAct(val)}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">
                      {t.radialActionEast}
                    </label>
                    <NeoDropdown
                      value={eastAct}
                      onChange={(val) => setEastAct(val)}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">
                      {t.radialActionSouth}
                    </label>
                    <NeoDropdown
                      value={southAct}
                      onChange={(val) => setSouthAct(val)}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">
                      {t.radialActionWest}
                    </label>
                    <NeoDropdown
                      value={westAct}
                      onChange={(val) => setWestAct(val)}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="pencil-button-secondary px-4 h-9 text-xs font-semibold cursor-pointer"
          >
            {t.cancelBtn}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="pencil-button px-5 h-9 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.saveSettings}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
