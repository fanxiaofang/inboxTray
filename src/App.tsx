import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Item, ItemStatus } from './types';
import { getItems, getSettings } from './hooks/useDatabase';
import TitleBar from './components/TitleBar';
import StatusFilter from './components/StatusFilter';
import QuickInput from './components/QuickInput';
import ItemList from './components/ItemList';
import SettingsPanel from './components/SettingsPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { Settings, Inbox } from 'lucide-react';

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<ItemStatus | 'all'>('all');
  const [showSettings, setShowSettings] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await getItems(status);
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }, [filter]);

  const loadItemsRef = useRef(loadItems);
  useEffect(() => {
    loadItemsRef.current = loadItems;
  });

  useEffect(() => {
    const load = async () => {
      try {
        const status = filter === 'all' ? undefined : filter;
        const data = await getItems(status);
        setItems(data);
      } catch (error) {
        console.error('Failed to load items:', error);
      }
    };
    load();
  }, [filter]);

  // 启动时从数据库读取快捷键并注册
  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        await invoke('register_hotkey', { hotkey: s.hotkey });
      } catch (e) {
        console.warn('注册快捷键失败:', e);
      }
    })();
  }, []);

  // 监听快捷小窗的保存事件，自动刷新列表
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('item-created', () => {
      loadItemsRef.current();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <ErrorBoundary>
    <div className="h-screen flex flex-col bg-app-bg text-app-text font-serif overflow-hidden">
      <TitleBar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏：筛选 + 设置 */}
        <div className="flex items-center justify-between px-4 border-b border-app-border">
          <StatusFilter value={filter} onChange={setFilter} />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 transition-colors ${showSettings ? 'text-app-accent-hover bg-app-accent-soft' : 'text-app-muted hover:text-app-accent hover:bg-app-accent-soft'}`}
          >
            <Settings size={16} />
          </button>
        </div>

        {showSettings ? (
          <SettingsPanel 
            onClose={() => setShowSettings(false)} 
            onSaved={loadItems} 
          />
        ) : (
          <>
            {/* 输入区域 */}
            <div className="px-4 py-3">
              <QuickInput onItemCreated={loadItems} />
            </div>
            
            {/* 内容列表 */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
              <ItemList items={items} onRefresh={loadItems} />
            </div>
            
            {/* 底部统计栏 */}
            <div className="px-4 py-2 border-t border-app-border flex justify-between items-center text-[10px] text-app-muted">
              <span>{items.length} 条记录</span>
              <Inbox size={14} />
            </div>
          </>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default App;
