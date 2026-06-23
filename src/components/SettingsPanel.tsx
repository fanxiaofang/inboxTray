import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Settings as SettingsType, ThemeMode } from '../types';
import { getSettings, saveSettings } from '../hooks/useDatabase';
import { emit } from '@tauri-apps/api/event';
import { FolderOpen, RotateCcw, Save, ArrowLeft } from 'lucide-react';
import HotkeyRecorder from './HotkeyRecorder';

interface SettingsPanelProps {
  onClose: () => void;
  onSaved: () => void;
}

const THEMES: { value: ThemeMode; label: string; swatch: string }[] = [
  { value: 'brass',  label: '黄铜暗色', swatch: '#b8860b' },
  { value: 'light',  label: '日间浅色', swatch: '#2563eb' },
  { value: 'slate',  label: '石板蓝',   swatch: '#60a5fa' },
  { value: 'forest', label: '冷杉暗色', swatch: '#6ee7b7' },
];

/** 路径中部截断：保留头尾，中间用 ... 替代 */
function truncateMiddle(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const head = Math.floor((maxLen - 3) * 0.4);
  const tail = maxLen - 3 - head;
  return path.slice(0, head) + '...' + path.slice(-tail);
}

export default function SettingsPanel({ onClose, onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Partial<SettingsType>>({});
  const [original, setOriginal] = useState<SettingsType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hotkeyError, setHotkeyError] = useState('');
  const [appInfo, setAppInfo] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSettings();
        setOriginal(data);
        setSettings(data);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    })();
  }, []);

  useEffect(() => {
    invoke<Record<string, string>>('get_app_info')
      .then(setAppInfo)
      .catch(() => {});
  }, []);

  const handleSelectObsidianPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择 Obsidian 仓库',
    });
    if (selected) {
      setSettings(prev => ({ ...prev, obsidianPath: selected as string }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (settings.theme) {
        document.documentElement.dataset.theme = settings.theme;
        emit('theme-changed', { theme: settings.theme });
      }
      await saveSettings(settings);
      if (settings.hotkey) {
        try {
          await invoke('register_hotkey', { hotkey: settings.hotkey });
          setHotkeyError('');
        } catch (e) {
          setHotkeyError(`快捷键注册失败: ${e}`);
          return;
        }
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (original) {
      setSettings(original);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onClose}
          className="p-1 hover:bg-app-accent-soft rounded transition-colors"
        >
          <ArrowLeft size={16} className="text-app-accent" />
        </button>
        <h2 className="text-base font-display text-app-accent-hover tracking-wider">设置</h2>
      </div>

      {/* ---- 功能设置区 ---- */}
      <div className="space-y-4">

        {/* 快捷键 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            全局快捷键
          </label>
          <HotkeyRecorder
            value={settings.hotkey || ''}
            onChange={(v) => setSettings(prev => ({ ...prev, hotkey: v }))}
          />
          {hotkeyError && (
            <p className="text-[10px] text-app-danger mt-1">{hotkeyError}</p>
          )}
        </div>

        {/* Obsidian 路径 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            Obsidian 仓库路径
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.obsidianPath || ''}
              readOnly
              className="steampunk-input flex-1 text-sm"
              placeholder="选择你的 Obsidian 仓库文件夹..."
            />
            <button
              onClick={handleSelectObsidianPath}
              className="steampunk-button flex items-center gap-1 whitespace-nowrap"
            >
              <FolderOpen size={14} />
              浏览
            </button>
          </div>
        </div>

        {/* Inbox 文件夹 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            Inbox 文件夹名称
          </label>
          <input
            type="text"
            value={settings.inboxFolder || ''}
            onChange={(e) => setSettings(prev => ({ ...prev, inboxFolder: e.target.value }))}
            className="steampunk-input w-full text-sm"
            placeholder="Inbox"
          />
        </div>

        {/* 外观 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            外观
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, theme: t.value }))}
                className={`steampunk-button flex items-center gap-2 text-xs ${
                  settings.theme === t.value ? 'steampunk-button-primary' : ''
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-app-border shrink-0"
                  style={{ backgroundColor: t.swatch }}
                />
                <span className="flex-1 text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="steampunk-button steampunk-button-primary flex-1 flex items-center justify-center gap-2"
          >
            <Save size={14} />
            保存
          </button>
          <button
            onClick={handleReset}
            className="steampunk-button flex items-center gap-2"
          >
            <RotateCcw size={14} />
            重置
          </button>
          <button
            onClick={onClose}
            className="steampunk-button"
          >
            取消
          </button>
        </div>
      </div>

      {/* ---- 底部信息区 ---- */}
      <div className="mt-6 pt-4 border-t border-app-border/50 space-y-4">
        {/* 隐私声明 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            隐私声明
          </label>
          <p className="text-[11px] text-app-text/70 leading-relaxed">
            所有数据仅存储于您的设备，不上传任何云端或第三方服务器。
            推送至 Obsidian 时，数据直接写入您指定的本地 Obsidian 仓库。
          </p>
        </div>

        {/* 关于 */}
        <div>
          <label className="text-xs text-app-accent-hover mb-2 flex items-center gap-1.5">
            <span className="text-app-warning text-[8px]">◆</span>
            关于
          </label>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-app-muted">版本</span>
              <span className="text-app-text/80">InboxTray v{appInfo?.version || '0.1.0'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-app-muted">数据存储位置</span>
              <span
                className="text-app-text/80 font-mono text-right cursor-help"
                title={appInfo?.dataDir || ''}
              >
                {truncateMiddle(appInfo?.dataDir || '', 40)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
