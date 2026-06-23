import { useState, useEffect, useRef, useCallback } from 'react';
import { Keyboard } from 'lucide-react';

interface HotkeyRecorderProps {
  value: string;
  onChange: (value: string) => void;
}

export default function HotkeyRecorder({ value, onChange }: HotkeyRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatKey = useCallback((e: KeyboardEvent): string => {
    const key = e.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';

    let display = '';
    if (e.ctrlKey) display += 'Ctrl+';
    if (e.altKey) display += 'Alt+';
    if (e.shiftKey) display += 'Shift+';
    if (e.metaKey) display += 'Meta+';

    let mainKey = '';
    if (key === ' ') mainKey = 'Space';
    else if (key.startsWith('Arrow')) mainKey = key.replace('Arrow', '');
    else if (key.startsWith('F') && /^F\d+$/.test(key)) mainKey = key.toUpperCase();
    else if (key.length === 1) mainKey = key.toUpperCase();
    else mainKey = key.charAt(0).toUpperCase() + key.slice(1);

    return display + mainKey;
  }, []);

  const hasModifier = (e: KeyboardEvent): boolean =>
    e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape' && !hasModifier(e)) {
      setIsRecording(false);
      return;
    }

    if (!hasModifier(e)) return;

    const combo = formatKey(e);
    if (combo) {
      onChange(combo);
      setIsRecording(false);
    }
  }, [formatKey, onChange]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isRecording, handleKeyDown]);

  useEffect(() => {
    if (isRecording) {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsRecording(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isRecording]);

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsRecording(true)}
        className={`steampunk-input w-full text-sm text-left flex items-center gap-2 cursor-pointer transition-colors ${
          isRecording ? 'border-app-accent-hover text-app-accent-hover' : ''
        }`}
      >
        <Keyboard size={14} className="text-app-muted shrink-0" />
        <span className={isRecording ? 'text-app-accent-hover animate-pulse' : ''}>
          {isRecording ? '按下新的快捷键...' : (value || '点击设置快捷键')}
        </span>
      </button>
    </div>
  );
}
