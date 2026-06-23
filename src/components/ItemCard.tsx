import { useState, useEffect, useCallback } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { Item, ItemStatus } from '../types';
import { updateItemStatus, updateItemContent, deleteItem, getSettings } from '../hooks/useDatabase';
import { Link, Image, FileText, Check, ExternalLink, Trash2, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from './ui/Badge';

interface ItemCardProps {
  item: Item;
  onRefresh: () => void;
}

function formatTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

/** 渲染简易 Markdown：复选框 - [ ] / - [x] 和列表 - */
function renderMarkdown(text: string, onToggleCheckbox?: (lineIndex: number) => void): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // 空行渲染为间隔
    if (line.trim() === '') return <div key={i} className="h-1" />;

    // 复选框：- [ ] 或 - [x]
    const cb = line.match(/^-\s*\[\s*([ xX])\s*\]\s*(.*)/);
    if (cb) {
      return (
        <div key={i} className="flex items-start gap-1.5">
          <span
            className={`text-app-warning text-xs mt-0.5 shrink-0 select-none ${onToggleCheckbox ? 'cursor-pointer hover:text-app-warning-hover' : ''}`}
            onClick={onToggleCheckbox ? (e) => { e.stopPropagation(); onToggleCheckbox(i); } : undefined}
          >
            {cb[1].toLowerCase() === 'x' ? '☑' : '☐'}
          </span>
          <span className="text-xs text-app-text/80">{cb[2]}</span>
        </div>
      );
    }

    // 无序列表：- text
    const bullet = line.match(/^-\s+(.*)/);
    if (bullet) {
      return (
        <div key={i} className="flex items-start gap-1.5">
          <span className="text-app-muted text-xs mt-0.5 shrink-0 select-none">•</span>
          <span className="text-xs text-app-text/80">{bullet[1]}</span>
        </div>
      );
    }

    // 普通文本
    return <p key={i} className="text-xs text-app-text/80">{line}</p>;
  });
}

/** 将 imagePath 按 ; 拆分成文件名数组 */
function splitImagePaths(imagePath: string): string[] {
  return imagePath
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ItemCard({ item, onRefresh }: ItemCardProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [appDir, setAppDir] = useState<string>('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageFiles = item.imagePath ? splitImagePaths(item.imagePath) : [];

  useEffect(() => {
    if (item.imagePath) {
      appLocalDataDir().then(setAppDir);
    }
  }, [item.imagePath]);

  // ESC 关闭 lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight' && lightboxIndex < imageFiles.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
      }
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, imageFiles.length]);

  const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const lightboxSrc =
    lightboxIndex !== null && appDir
      ? convertFileSrc(appDir + '/' + imageFiles[lightboxIndex])
      : '';

  const getIcon = () => {
    switch (item.contentType) {
      case 'link': return <Link size={14} className="text-app-warning" />;
      case 'image':
      case 'mixed': return <Image size={14} className="text-app-warning" />;
      default: return <FileText size={14} className="text-app-accent/60" />;
    }
  };

  const getDisplayType = () => {
    if (item.url && item.imagePath && item.content) return '图文链接';
    if (item.url && item.imagePath) return '链接+截图';
    if (item.url && item.content) return '笔记+链接';
    if (item.imagePath && item.content) return '图文笔记';
    if (item.imagePath) return '图片';
    if (item.url) return '链接';
    return '文字';
  };

  const handlePushToObsidian = async () => {
    setIsPushing(true);
    try {
      const settings = await getSettings();

      if (!settings.obsidianPath) {
        alert('请先在设置中配置 Obsidian 仓库路径');
        return;
      }

      await invoke('push_to_obsidian', {
        item,
        obsidianPath: settings.obsidianPath,
        inboxFolder: settings.inboxFolder,
      });

      await updateItemStatus(item.id, 'pushed');
      onRefresh();
    } catch (error) {
      console.error('Failed to push:', error);
      alert('推送失败: ' + error);
    } finally {
      setIsPushing(false);
    }
  };

  const handleStatusChange = async (status: ItemStatus) => {
    await updateItemStatus(item.id, status);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这条记录吗？')) return;
    await deleteItem(item.id);
    onRefresh();
  };

  const handleToggleCheckbox = useCallback(async (lineIndex: number) => {
    if (item.status !== 'pending') return;
    const lines = item.content.split('\n');
    const line = lines[lineIndex];
    let newLine: string;
    if (line.includes('- [ ] ')) {
      newLine = line.replace('- [ ] ', '- [x] ');
    } else if (line.includes('- [x] ') || line.includes('- [X] ')) {
      newLine = line.replace('- [x] ', '- [ ] ').replace('- [X] ', '- [ ] ');
    } else {
      return;
    }
    lines[lineIndex] = newLine;
    await updateItemContent(item.id, lines.join('\n'));
    onRefresh();
  }, [item.id, item.content, item.status, onRefresh]);

  const isPushed = item.status === 'pushed';
  const isSingle = imageFiles.length === 1;
  const hideContent = item.contentType === 'link' && item.content === item.url;

  return (
    <>
      <div className={`steampunk-border p-3 group hover:bg-app-surface/70 transition-colors ${isPushed ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0">{getIcon()}</div>
          
          <div className="flex-1 min-w-0">
            {!hideContent && (
            <div className={`break-words ${isPushed ? 'text-app-muted line-through' : ''}`}>
              {item.status === 'pending'
                ? renderMarkdown(item.content, handleToggleCheckbox)
                : renderMarkdown(item.content)}
            </div>
            )}
            
            {/* title 和 url 作为链接单元，紧跟在文字下方 */}
            {item.title && (
              <h4 className={`text-sm font-medium text-app-accent-hover truncate ${!hideContent ? 'mt-2' : ''}`}>{item.title}</h4>
            )}
            
            {item.url && (
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                title={item.url}
                className="text-xs text-app-warning hover:text-app-accent-hover flex items-start gap-1 mt-1 break-all"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <ExternalLink size={10} className="mt-0.5 flex-shrink-0" />
                <span>{item.url}</span>
              </a>
            )}
            
            {/* 图片展示 */}
            {imageFiles.length > 0 && (
              <div className="mt-2">
                {isSingle && appDir ? (
                  /* 单张：撑满宽度，点击查看原图 */
                  <img
                    src={convertFileSrc(appDir + '/' + imageFiles[0])}
                    alt={imageFiles[0]}
                    onClick={() => openLightbox(0)}
                    className="w-full max-h-64 object-contain rounded border border-app-border cursor-pointer hover:opacity-90 transition-opacity"
                  />
                ) : (
                  /* 多张：4 列缩略图 grid */
                  <div className="grid grid-cols-4 gap-1">
                    {imageFiles.slice(0, 5).map((file, idx) => (
                      appDir ? (
                        <div key={idx} className="relative cursor-pointer" onClick={() => openLightbox(idx)}>
                          <img
                            src={convertFileSrc(appDir + '/' + file)}
                            alt={file}
                            className="w-full h-16 object-cover rounded border border-app-border hover:opacity-80 transition-opacity"
                          />
                          {idx === 4 && imageFiles.length > 5 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-app-bg/70 rounded text-xs text-app-accent-hover">
                              +{imageFiles.length - 5}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div key={idx} className="w-full h-16 bg-app-accent-soft rounded border border-app-border" />
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-app-muted">
                  {formatTime(item.createdAt)}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 border border-app-border text-app-muted rounded-sm">
                  {getDisplayType()}
                </span>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.status === 'pending' && (
                  <button
                    onClick={handlePushToObsidian}
                    disabled={isPushing}
                    className="p-1 hover:bg-app-warning/20 rounded text-xs text-app-warning hover:text-app-warning-hover transition-colors"
                    title="推送到 Obsidian"
                  >
                    <Check size={12} />
                  </button>
                )}
                {item.status === 'pushed' && (
                  <button
                    onClick={() => handleStatusChange('pending')}
                    className="p-1 hover:bg-app-accent-soft rounded text-xs text-app-accent/60 hover:text-app-accent transition-colors"
                    title="标记为待处理"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="p-1 hover:bg-app-danger/20 rounded text-xs text-app-muted hover:text-app-danger transition-colors"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <Badge status={item.status} />
          </div>
        </div>
      </div>

      {/* Lightbox / 原图查看 */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* 关闭按钮 */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
          >
            <X size={24} />
          </button>

          {/* 左箭头 */}
          {imageFiles.length > 1 && lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 p-2 text-white/60 hover:text-white transition-colors z-10"
            >
              <ChevronLeft size={32} />
            </button>
          )}

          {/* 原图 */}
          <img
            src={lightboxSrc}
            alt="原图"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 右箭头 */}
          {imageFiles.length > 1 && lightboxIndex < imageFiles.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
            >
              <ChevronRight size={32} />
            </button>
          )}

          {/* 计数 */}
          {imageFiles.length > 1 && (
            <div className="absolute bottom-4 text-white/60 text-xs">
              {lightboxIndex + 1} / {imageFiles.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
