import React, { useState } from 'react';
import { Settings, Keyboard, Compass, Link2, Folder, Palette, Languages, Check, Save, Bot, Video } from 'lucide-react';
import { translations, Language } from '../locales/translations';
import { AppConfig } from '../../electron/types';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';
import { ThaiFlag, UkFlag } from './SvgFlags';

interface SettingsSectionProps {
  language: Language;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
  onThemeChange: (theme: AppConfig['theme']) => void;
  onLanguageChange: (lang: Language) => void;
  onBrowseFolder: () => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  language,
  config,
  onSaveConfig,
  onThemeChange,
  onLanguageChange,
  onBrowseFolder
}) => {
  const t = translations[language];

  const [enableClipboard, setEnableClipboard] = useState(config.enableClipboardMonitor !== false);
  const [enableRadial, setEnableRadial] = useState(config.enableRadialMenu !== false);
  const [shortcut, setShortcut] = useState(config.radialShortcut || 'Alt+Q');
  const [isRecording, setIsRecording] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [northAct, setNorthAct] = useState(config.radialActions?.north || 'actDownloadVideo');
  const [eastAct, setEastAct] = useState(config.radialActions?.east || 'actDownloadAudio');
  const [southAct, setSouthAct] = useState(config.radialActions?.south || 'actOpenFolder');
  const [westAct, setWestAct] = useState(config.radialActions?.west || 'actOpenConvert');
  const [defaultResolution, setDefaultResolution] = useState(config.defaultVideoResolution || '1080p');
  const [enableRemote, setEnableRemote] = useState(config.enableDiscordRemote !== false);
  const [channelId, setChannelId] = useState(config.discordChannelId || '');
  const wsUrl = config.discordWsUrl && config.discordWsUrl !== 'ws://localhost:4040'
    ? config.discordWsUrl
    : 'wss://loadstreaming-bot.onrender.com';

  const resolutionOptions: NeoDropdownOption<string>[] = [
    { value: '2160p', label: '2160p (4K Ultra HD)' },
    { value: '1440p', label: '1440p (2K Quad HD)' },
    { value: '1080p', label: language === 'th' ? '1080p (Full HD - แนะนำ)' : '1080p (Full HD - Recommended)' },
    { value: '720p', label: '720p (HD)' },
    { value: '480p', label: '480p' },
    { value: '360p', label: '360p' }
  ];

  const actionOptions: NeoDropdownOption<string>[] = [
    { value: 'actDownloadVideo', label: `${t.actDownloadVideo} (${defaultResolution})` },
    { value: 'actDownloadVideo4K', label: language === 'th' ? 'ดาวน์โหลดวิดีโอ 4K (2160p)' : 'Download Video (4K 2160p)' },
    { value: 'actDownloadVideo1080p', label: language === 'th' ? 'ดาวน์โหลดวิดีโอ 1080p (Full HD)' : 'Download Video (1080p FHD)' },
    { value: 'actDownloadVideo720p', label: language === 'th' ? 'ดาวน์โหลดวิดีโอ 720p (HD)' : 'Download Video (720p HD)' },
    { value: 'actDownloadAudio', label: t.actDownloadAudio },
    { value: 'actOpenFolder', label: t.actOpenFolder },
    { value: 'actOpenConvert', label: t.actOpenConvert },
    { value: 'actToggleApp', label: t.actToggleApp }
  ];

  const themeOptions: NeoDropdownOption<AppConfig['theme']>[] = [
    { value: 'yellow-black', label: t.themeYellowBlack },
    { value: 'white-black', label: t.themeWhiteBlack },
    { value: 'white-blue', label: t.themeWhiteBlue },
    { value: 'black-blue', label: t.themeBlackBlue },
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
      },
      defaultVideoResolution: defaultResolution,
      enableDiscordRemote: enableRemote,
      discordChannelId: channelId,
      discordWsUrl: wsUrl
    });

    if (window.electronAPI) {
      window.electronAPI.registerRadialShortcut(shortcut);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full select-none pb-8 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[var(--color-border)]">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[var(--color-accent)]" />
          <h2 className="text-sm font-bold tracking-wide uppercase">{t.settingsTitle}</h2>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="pencil-button px-5 h-9 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          {isSaved ? <Check className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? (language === 'th' ? 'บันทึกเรียบร้อย' : 'Saved') : t.saveSettings}</span>
        </button>
      </div>

      {/* Section 1: Quick Radial Menu & Keybinds Customization */}
      <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 pb-2">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-[var(--color-accent)]" />
            <div>
              <h3 className="text-xs font-bold">{t.enableRadialMenuLabel}</h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {language === 'th' 
                  ? 'เรียกวงล้อลอยสั่งการ ณ จุดที่เมาส์อยู่ เพื่อดาวน์โหลดหรือแปลงไฟล์ได้ทันทีโดยไม่ต้องเปิดโปรแกรม' 
                  : 'Quick floating radial overlay menu at mouse cursor position'}
              </p>
            </div>
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
          <div className="space-y-3 pt-1">
            {/* Hotkey Recorder */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
              <label className="text-xs font-bold text-[var(--color-text-main)] flex items-center space-x-1.5 shrink-0">
                <Keyboard className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>{t.radialShortcutLabel}</span>
              </label>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <input
                  type="text"
                  readOnly
                  value={isRecording ? t.pressKeysToRecord : shortcut}
                  onKeyDown={isRecording ? handleKeyDownRecord : undefined}
                  className={`w-full sm:w-48 h-8 px-2.5 text-xs font-mono font-bold rounded border-2 outline-none text-[var(--color-text-main)] ${
                    isRecording
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 animate-pulse'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setIsRecording(!isRecording)}
                  className="pencil-button-secondary px-3 h-8 text-xs font-semibold cursor-pointer shrink-0"
                >
                  {isRecording ? t.cancelBtn : (language === 'th' ? 'เปลี่ยนปุ่ม' : 'Change Key')}
                </button>
              </div>
            </div>

            {/* Slices Customization - Spacious & Extensible */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {language === 'th' ? 'กำหนดปุ่มและคำสั่งประจำทิศทาง' : 'Configure Radial Slices & Commands'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                  <span className="text-xs font-bold text-[var(--color-text-main)] shrink-0 w-32">
                    {t.radialActionNorth}
                  </span>
                  <div className="flex-1 min-w-0">
                    <NeoDropdown
                      value={northAct}
                      onChange={setNorthAct}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                  <span className="text-xs font-bold text-[var(--color-text-main)] shrink-0 w-32">
                    {t.radialActionEast}
                  </span>
                  <div className="flex-1 min-w-0">
                    <NeoDropdown
                      value={eastAct}
                      onChange={setEastAct}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                  <span className="text-xs font-bold text-[var(--color-text-main)] shrink-0 w-32">
                    {t.radialActionSouth}
                  </span>
                  <div className="flex-1 min-w-0">
                    <NeoDropdown
                      value={southAct}
                      onChange={setSouthAct}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                  <span className="text-xs font-bold text-[var(--color-text-main)] shrink-0 w-32">
                    {t.radialActionWest}
                  </span>
                  <div className="flex-1 min-w-0">
                    <NeoDropdown
                      value={westAct}
                      onChange={setWestAct}
                      options={actionOptions}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Clipboard Monitor */}
      <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-2 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-[var(--color-accent)]" />
            <div>
              <h3 className="text-xs font-bold">{t.enableClipboardMonitorLabel}</h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {language === 'th' 
                  ? 'ตรวจพบคลิปวิดีโอทันทีเมื่อกดคัดลอกลิงก์จากเบราว์เซอร์ พร้อมแจ้งเตือนลอยมุมจอเดสก์ท็อป' 
                  : 'Detect copied video links and show desktop notification automatically'}
              </p>
            </div>
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
      </div>

      {/* Section 3: Storage Folder */}
      <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-2 shadow-md">
        <div className="flex items-center space-x-2 border-b border-[var(--color-border)]/50 pb-2">
          <Folder className="w-4 h-4 text-[var(--color-accent)]" />
          <div>
            <h3 className="text-xs font-bold">{t.outputFolderLabel}</h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {language === 'th' ? 'โฟลเดอร์หลักสำหรับจัดเก็บไฟล์วิดีโอและไฟล์เสียงที่ดาวน์โหลด' : 'Default directory for downloaded media'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <input
            type="text"
            readOnly
            value={config.outputDir}
            className="flex-1 h-9 px-3 text-xs font-mono bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)] truncate cursor-default"
          />
          <button
            type="button"
            onClick={onBrowseFolder}
            className="pencil-button-secondary px-4 h-9 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t.browseFolder}</span>
          </button>
        </div>
      </div>

      {/* Section 4: Default Video Resolution for Quick Downloads */}
      <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-2 shadow-md">
        <div className="flex items-center space-x-2 border-b border-[var(--color-border)]/50 pb-2">
          <Video className="w-4 h-4 text-[var(--color-accent)]" />
          <div>
            <h3 className="text-xs font-bold">
              {language === 'th' ? 'ความละเอียดวิดีโอเริ่มต้นสำหรับการสั่งงานด่วน' : 'Default Quick Download Resolution'}
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {language === 'th'
                ? 'ความละเอียดที่ใช้เมื่อสั่งดาวน์โหลดผ่านวงล้อคีย์ลัด หรือเมื่อสั่งงานผ่าน Discord Bot โดยไม่ระบุความละเอียด'
                : 'Preferred resolution used by Radial shortcut and Discord Bot remote downloads'}
            </p>
          </div>
        </div>

        <div className="pt-1 max-w-xs">
          <NeoDropdown
            value={defaultResolution}
            onChange={setDefaultResolution}
            options={resolutionOptions}
            size="sm"
          />
        </div>
      </div>

      {/* Section 4: Theme & Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Theme Card */}
        <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-2 shadow-md">
          <div className="flex items-center space-x-2 border-b border-[var(--color-border)]/50 pb-2">
            <Palette className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-xs font-bold">{t.themeLabel}</h3>
          </div>
          <div className="pt-1">
            <NeoDropdown
              value={config.theme}
              onChange={(val) => onThemeChange(val as AppConfig['theme'])}
              options={themeOptions}
              size="sm"
            />
          </div>
        </div>

        {/* Language Card */}
        <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-2 shadow-md">
          <div className="flex items-center space-x-2 border-b border-[var(--color-border)]/50 pb-2">
            <Languages className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-xs font-bold">{language === 'th' ? 'ภาษาของโปรแกรม' : 'Application Language'}</h3>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={() => onLanguageChange('th')}
              className={`flex-1 h-9 flex items-center justify-center space-x-2 rounded border-2 text-xs font-bold transition-all cursor-pointer ${
                language === 'th'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <ThaiFlag className="w-4 h-3" />
              <span>ภาษาไทย (TH)</span>
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`flex-1 h-9 flex items-center justify-center space-x-2 rounded border-2 text-xs font-bold transition-all cursor-pointer ${
                language === 'en'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <UkFlag className="w-4 h-3" />
              <span>English (EN)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Remote Download Bot Integration */}
      <div className="pencil-box p-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-main)] space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 pb-2">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-xs font-bold">{t.discordRemoteTitle}</h3>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
              {t.enableDiscordRemoteLabel}
            </span>
            <input
              type="checkbox"
              checked={enableRemote}
              onChange={(e) => setEnableRemote(e.target.checked)}
              className="accent-[var(--color-accent)] w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>

        {enableRemote && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--color-text-muted)]">
                {t.discordChannelIdLabel}
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder={t.discordChannelIdPlaceholder}
                className="w-full h-8 px-2.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text-main)] font-mono outline-hidden focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--color-text-muted)]">
                {t.discordWsUrlLabel}
              </label>
              <input
                type="text"
                value="wss://loadstreaming-bot.onrender.com"
                readOnly
                placeholder="wss://loadstreaming-bot.onrender.com"
                className="w-full h-8 px-2.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text-muted)] font-mono outline-hidden cursor-not-allowed opacity-80"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
