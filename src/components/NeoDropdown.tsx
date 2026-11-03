import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface NeoDropdownOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string;
}

export interface NeoDropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: NeoDropdownOption<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  maxHeight?: string;
}

export function NeoDropdown<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  disabled = false,
  size = 'sm',
  fullWidth = true,
  maxHeight = 'max-h-60',
}: NeoDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs',
    md: 'py-2 px-3 text-xs sm:text-sm',
    lg: 'py-2.5 px-4 text-sm sm:text-base',
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 font-bold text-left transition-all ${sizeClasses} ${
          disabled
            ? 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-2 border-[var(--color-border)] cursor-not-allowed opacity-50 rounded'
            : isOpen
            ? 'bg-[var(--color-surface)] text-[var(--color-text-main)] border-2 border-[var(--color-accent)] rounded shadow-xs'
            : 'bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] rounded hover:border-[var(--color-accent)]'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-[var(--color-accent)]">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.2 bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded font-semibold shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 text-[var(--color-text-muted)] ${
            isOpen ? 'rotate-180 text-[var(--color-accent)]' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 mt-1 ${maxHeight} overflow-y-auto bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded p-1 shadow-xl animate-in fade-in duration-100 ${dropdownClassName}`}
          style={{ minWidth: '100%' }}
        >
          {options.length === 0 ? (
            <div className="py-2 px-3 text-xs text-[var(--color-text-muted)] text-center font-medium">
              ไม่มีตัวเลือก
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold text-left rounded transition-colors my-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                      : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {opt.icon && (
                      <span className="shrink-0">{opt.icon}</span>
                    )}
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10px] opacity-75 font-normal">
                        ({opt.sublabel})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {opt.badge && (
                      <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-black/20">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={12} className="shrink-0" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
