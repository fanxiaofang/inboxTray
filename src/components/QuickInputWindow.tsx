import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { readImage } from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Image, Send, Loader2, CheckSquare, List } from 'lucide-react';
import { CreateItemRequest } from '../types';
import { createItem } from '../hooks/useDatabase';
import { compressImage } from '../utils/imageCompress';
import TitleBar from './TitleBar';

const appWindow = getCurrentWindow();
const MAX_IMAGES = 5;

/** 从文本中提取第一个 URL */
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

async function rgbaToPng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imgData, 0, 0);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

async function writeImageFile(imageBytes: Uint8Array): Promise<string> {
  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const fileName = `image_${Date.now()}.png`;
  await writeFile(fileName, imageBytes, { baseDir: BaseDirectory.AppLocalData });
  return fileName;
}

export default function QuickInputWindow() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<Uint8Array[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  // 监听主题变更
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ theme: string }>('theme-changed', (event) => {
      document.documentElement.dataset.theme = event.payload.theme;
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const detectContentType = (text: string): string => {
    if (text.startsWith('http://') || text.startsWith('https://')) return 'link';
    return 'text';
  };

  const handleSubmit = async () => {
    const hasText = content.trim().length > 0;
    const hasImage = pendingImages.length > 0;
    if (!hasText && !hasImage) return;

    setIsLoading(true);
    try {
      const fileNames: string[] = [];
      for (const img of pendingImages) {
        fileNames.push(await writeImageFile(img));
      }
      setPendingImages([]);
      const imagePath = fileNames.join(';');

      const trimmed = content.trim();
      const rawType = detectContentType(trimmed);
      let ct: CreateItemRequest['contentType'];
      let url: string | undefined;
      let title: string | undefined;

      if (hasText && hasImage) {
        ct = 'mixed';
      } else if (hasImage) {
        ct = 'image';
      } else {
        ct = rawType as 'text' | 'link';
      }

      // 提取 URL（支持文本中内嵌链接）- 一次 fetch 同时获取 title 和 description
      const extractedUrl = extractUrl(trimmed);
      const isPureLink = extractedUrl !== null && trimmed === extractedUrl;

      let pageMeta: { title?: string | null; description?: string | null } | null = null;
      if (extractedUrl) {
        url = extractedUrl;
        try {
          pageMeta = await invoke<{ title?: string | null; description?: string | null }>('fetch_page_meta', { url: extractedUrl });
        } catch { /* ignore */ }
      }

      if (pageMeta?.title) title = pageMeta.title;

      // 纯链接：用 og:description 作为内容；否则去掉 URL 避免重复显示
      let finalContent: string;
      if (isPureLink) {
        finalContent = pageMeta?.description || trimmed;
      } else {
        finalContent = extractedUrl ? trimmed.replace(extractedUrl, '').trim() : trimmed;
        if (!finalContent) finalContent = trimmed;
      }

      await createItem({
        content: finalContent,
        contentType: ct,
        url: url,
        title: title,
        imagePath: imagePath || undefined,
      });

      setContent('');
      emit('item-created');
      appWindow.hide();
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /** 在选中行的行首或当前行行首插入指定前缀 */
  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (start !== end) {
      // 有选区 — 对选区跨越的所有行首添加前缀
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const lineAfterEnd = content.indexOf('\n', end);
      const endIdx = lineAfterEnd === -1 ? content.length : lineAfterEnd;
      const selectedPortion = content.substring(lineStart, endIdx);
      const lines = selectedPortion.split('\n');
      const newLines = lines.map((l) => prefix + l);
      const newPortion = newLines.join('\n');
      const newValue = content.substring(0, lineStart) + newPortion + content.substring(endIdx);
      setContent(newValue);
      setTimeout(() => {
        const newCursorPos = lineStart + newPortion.length;
        el.selectionStart = el.selectionEnd = newCursorPos;
        el.focus();
      }, 0);
    } else {
      // 无选区 — 在当前行首插入
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const newValue = content.substring(0, lineStart) + prefix + content.substring(lineStart);
      setContent(newValue);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = lineStart + prefix.length;
        el.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      appWindow.hide();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    // Enter 自动延续列表（- 或 - [ ]）
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = textareaRef.current;
      if (!el) return;
      const cursorPos = el.selectionStart;
      const lineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
      const lineEnd = content.indexOf('\n', cursorPos);
      const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
      const m = currentLine.match(/^(-\s\[\s*\]\s|-\s)/);
      if (m) {
        e.preventDefault();
        const matchedPrefix = m[1];
        const lineContent = currentLine.slice(matchedPrefix.length);
        if (lineContent.trim() === '') {
          // 空行 → 去掉当前行前缀并换行（打破列表）
          const newValue = content.substring(0, lineStart) + '\n' + content.substring(cursorPos);
          setContent(newValue);
          setTimeout(() => {
            el.selectionStart = el.selectionEnd = lineStart + 1;
            el.focus();
          }, 0);
        } else {
          // 有内容 → 延续列表
          const newValue = content.substring(0, cursorPos) + '\n' + matchedPrefix + content.substring(cursorPos);
          setContent(newValue);
          setTimeout(() => {
            el.selectionStart = el.selectionEnd = cursorPos + 1 + matchedPrefix.length;
            el.focus();
          }, 0);
        }
      }
    }
  };

  /** 追加一张图片到暂存队列 */
  const addPendingImage = useCallback((buf: Uint8Array) => {
    setPendingImages((prev) => {
      if (prev.length >= MAX_IMAGES) {
        alert(`最多暂存 ${MAX_IMAGES} 张图片`);
        return prev;
      }
      return [...prev, buf];
    });
  }, []);

  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setIsLoading(true);
          try {
            const buf = await file.arrayBuffer();
            const compressed = await compressImage(new Uint8Array(buf), file.type);
            addPendingImage(compressed.data);
          } finally {
            setIsLoading(false);
          }
        }
        return;
      }
    }
    // Snipaste: 剪贴板类型是 Files 而非 image/*
    try {
      setIsLoading(true);
      const img = await readImage();
      const rgba = await img.rgba();
      const size = await img.size();
      const png = await rgbaToPng(rgba, size.width, size.height);
      const compressed = await compressImage(png, 'image/png');
      addPendingImage(compressed.data);
    } catch {
      // 剪贴板没有图片
    } finally {
      setIsLoading(false);
    }
  }, [addPendingImage]);

  return (
    <div className="h-screen flex flex-col bg-app-bg text-app-text" data-tauri-drag-region>
      <TitleBar showMinimize={false} onClose={() => appWindow.hide()} />

      <div className="flex-1 flex flex-col p-3 overflow-hidden">
        <div className="flex-1 flex flex-col border border-app-border rounded bg-app-surface p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`有什么想法？Ctrl+V 可贴图（≤${MAX_IMAGES}张）`}
            className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm min-h-[60px] placeholder:text-app-muted/60 leading-relaxed text-app-text overflow-x-hidden"
            autoFocus
          />

          {/* 暂存图片列表 */}
          {pendingImages.length > 0 && (
            <div className="mt-2 space-y-1 overflow-y-auto max-h-[120px]">
              {pendingImages.map((_, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 bg-app-accent-soft rounded border border-app-border">
                  <span className="text-[11px] text-app-accent-hover">
                    图片 {idx + 1}/{pendingImages.length}
                  </span>
                  <button
                    onClick={() => removePendingImage(idx)}
                    className="text-app-muted text-xs hover:text-app-danger transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-app-border">
            <div className="flex gap-1 items-center text-app-muted">
              <Image size={14} />
              <button
                type="button"
                onClick={() => insertLinePrefix('- [ ] ')}
                className="p-0.5 hover:bg-app-accent-soft rounded transition-colors"
                title="插入复选框"
              >
                <CheckSquare size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix('- ')}
                className="p-0.5 hover:bg-app-accent-soft rounded transition-colors"
                title="插入列表项"
              >
                <List size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-app-muted">
                {pendingImages.length > 0
                  ? `图文 ×${pendingImages.length}`
                  : content.length > 0
                    ? `${content.length} 字`
                    : ''}
              </span>
              <button
                onClick={handleSubmit}
                disabled={(!content.trim() && pendingImages.length === 0) || isLoading}
                className="steampunk-button steampunk-button-primary flex items-center gap-1.5"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>保存</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
