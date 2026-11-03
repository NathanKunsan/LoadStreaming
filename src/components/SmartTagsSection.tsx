import React, { useState, useEffect } from 'react';
import { Tag, Plus, Check, X, Folder, Edit2 } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface SmartTagsSectionProps {
  language: Language;
  videoTitle: string;
  channelTitle?: string;
  tags: string[];
  selectedSubFolder: string;
  onTagsChange: (tags: string[]) => void;
  onSelectSubFolder: (subFolder: string) => void;
}

export function detectAutoTags(title: string, channel?: string): string[] {
  const suggestions: string[] = [];

  // Series / Episode detection
  const epMatch = title.match(/(?:ep\.?|ตอนที่|part|#|season|ss)\s*(\d+)/i);
  if (epMatch) {
    // Extract base series name before or around episode marker
    const parts = title.split(/(?:ep\.?|ตอนที่|part|#|season|ss)\s*\d+/i);
    const candidate = parts[0]?.replace(/[-_–—|:\[\]\(\)]+$/g, '').trim();
    if (candidate && candidate.length > 2) {
      suggestions.push(candidate);
    }
  }

  // Language script detection
  const hasThai = /[\u0E00-\u0E7F]/.test(title);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(title);
  const hasKorean = /[\uAC00-\uD7AF]/.test(title);

  if (hasThai) {
    suggestions.push('เพลงไทย');
  } else if (hasJapanese) {
    suggestions.push('เพลงญี่ปุ่น');
  } else if (hasKorean) {
    suggestions.push('เพลงเกาหลี');
  } else if (/^[a-zA-Z0-9\s.,!?'"-_()]+$/.test(title)) {
    suggestions.push('เพลงสากล');
  }

  // Channel name
  if (channel && channel.trim().length > 1) {
    suggestions.push(channel.trim());
  }

  // Remove duplicates and empty
  return Array.from(new Set(suggestions.filter(Boolean)));
}

export const SmartTagsSection: React.FC<SmartTagsSectionProps> = ({
  language,
  videoTitle,
  channelTitle,
  tags,
  selectedSubFolder,
  onTagsChange,
  onSelectSubFolder
}) => {
  const t = translations[language];
  const [isAdding, setIsAdding] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTagInput, setEditTagInput] = useState('');

  // Auto-suggest tags when title changes
  useEffect(() => {
    if (videoTitle) {
      const detected = detectAutoTags(videoTitle, channelTitle);
      if (detected.length > 0 && tags.length === 0) {
        onTagsChange(detected);
        // Default select the first series tag if available
        if (!selectedSubFolder && detected[0]) {
          onSelectSubFolder(detected[0]);
        }
      }
    }
  }, [videoTitle, channelTitle]);

  const handleAddTag = () => {
    const val = newTagInput.trim();
    if (val && !tags.includes(val)) {
      const next = [...tags, val];
      onTagsChange(next);
      if (!selectedSubFolder) {
        onSelectSubFolder(val);
      }
    }
    setNewTagInput('');
    setIsAdding(false);
  };

  const handleRemoveTag = (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = tags.filter(t => t !== tagToRemove);
    onTagsChange(next);
    if (selectedSubFolder === tagToRemove) {
      onSelectSubFolder('');
    }
  };

  const handleStartEdit = (idx: number, currentVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(idx);
    setEditTagInput(currentVal);
  };

  const handleSaveEdit = (idx: number) => {
    const val = editTagInput.trim();
    if (val) {
      const oldVal = tags[idx];
      const next = [...tags];
      next[idx] = val;
      onTagsChange(next);
      if (selectedSubFolder === oldVal) {
        onSelectSubFolder(val);
      }
    }
    setEditingIndex(null);
  };

  return (
    <div className="p-3 my-2.5 bg-[var(--color-bg)]/40 border-2 border-[var(--color-border)]/60 rounded-lg space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <label className="font-bold opacity-90 flex items-center space-x-1.5 text-[var(--color-text-main)]">
          <Tag className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>{t.tagsLabel}</span>
        </label>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {t.tagFolderHint}
        </span>
      </div>

      {/* Tags Chips Bar */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-8">
        {tags.map((tag, idx) => {
          const isSelected = selectedSubFolder === tag;
          const isEditing = editingIndex === idx;

          if (isEditing) {
            return (
              <div key={idx} className="flex items-center space-x-1 bg-[var(--color-surface)] border border-[var(--color-accent)] rounded px-1.5 py-0.5">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(idx);
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  autoFocus
                  className="w-24 text-xs bg-transparent outline-none text-[var(--color-text-main)] font-semibold"
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(idx)}
                  className="text-green-400 hover:text-green-300 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={tag}
              onClick={() => onSelectSubFolder(isSelected ? '' : tag)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold shadow-xs'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
              title={t.tagFolderHint}
            >
              {isSelected && <Folder className="w-3 h-3 shrink-0" />}
              <span>{tag}</span>

              <button
                type="button"
                onClick={(e) => handleStartEdit(idx, tag, e)}
                className="opacity-60 hover:opacity-100 hover:text-blue-400 p-0.5 cursor-pointer"
                title={t.editTagTooltip}
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>

              <button
                type="button"
                onClick={(e) => handleRemoveTag(tag, e)}
                className="opacity-60 hover:opacity-100 hover:text-red-400 p-0.5 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        {/* Add Tag Button or Input */}
        {isAdding ? (
          <div className="flex items-center space-x-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-0.5">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              placeholder={t.addTagPlaceholder}
              autoFocus
              className="w-24 text-xs bg-transparent outline-none text-[var(--color-text-main)]"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="text-green-400 hover:text-green-300 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-red-400 hover:text-red-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="pencil-button-secondary px-2 py-1 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{t.addTagBtn}</span>
          </button>
        )}
      </div>

      {/* Subfolder active indicator */}
      {selectedSubFolder && (
        <div className="text-[11px] font-mono text-[var(--color-accent)] flex items-center space-x-1">
          <Folder className="w-3 h-3" />
          <span>
            {t.subFolderLabel}: <strong>{selectedSubFolder}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
