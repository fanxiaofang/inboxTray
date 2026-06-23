import { load } from '@tauri-apps/plugin-store';
import { Settings } from '../types';

const STORE_PATH = 'settings.json';

let store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!store) {
    store = await load(STORE_PATH);
  }
  return store;
}

export async function getSettings(): Promise<Settings> {
  const s = await getStore();
  const settings = await s.get<Settings>('app_settings');
  return settings || {
    id: 1,
    hotkey: 'Ctrl+Shift+Space',
    obsidianPath: '',
    inboxFolder: 'Inbox',
    theme: 'brass',
    autoStart: false,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const s = await getStore();
  const current = await getSettings();
  await s.set('app_settings', { ...current, ...settings });
}
