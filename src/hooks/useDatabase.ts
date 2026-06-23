import Database from '@tauri-apps/plugin-sql';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { remove } from '@tauri-apps/plugin-fs';
import { Item, ContentType, ItemStatus, CreateItemRequest, Settings, ThemeMode } from '../types';

let db: Database | null = null;
let initialized = false;

async function initSchema(database: Database): Promise<void> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL DEFAULT '',
      content_type TEXT NOT NULL DEFAULT 'text',
      title TEXT DEFAULT '',
      url TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      pushed_at INTEGER DEFAULT 0
    )
  `);
  await database.execute(
    'CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)'
  );
  await database.execute(
    'CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC)'
  );

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      hotkey TEXT NOT NULL DEFAULT 'Alt+Shift+Space',
      obsidian_path TEXT DEFAULT '',
      inbox_folder TEXT NOT NULL DEFAULT 'Inbox',
      theme TEXT NOT NULL DEFAULT 'brass',
      auto_start INTEGER NOT NULL DEFAULT 0
    )
  `);

  // 兼容旧数据库：若 auto_start 列不存在则添加
  try {
    await database.execute("ALTER TABLE settings ADD COLUMN auto_start INTEGER NOT NULL DEFAULT 0");
  } catch {
    // 列已存在，忽略
  }

  // 兼容旧数据库：若 theme 列不存在则添加
  try {
    await database.execute("ALTER TABLE settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'brass'");
  } catch {
    // 列已存在，忽略
  }

  await database.execute('INSERT OR IGNORE INTO settings (id) VALUES (1)');
}

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:inboxtray.db');
  }
  if (!initialized) {
    await initSchema(db);
    initialized = true;
  }
  return db;
}

function mapItem(row: Record<string, unknown>): Item {
  return {
    id: row.id as number,
    content: row.content as string,
    contentType: row.content_type as ContentType,
    title: row.title as string,
    url: row.url as string,
    imagePath: row.image_path as string,
    status: row.status as ItemStatus,
    createdAt: row.created_at as number,
    pushedAt: row.pushed_at as number,
  };
}

function mapSettings(row: Record<string, unknown>): Settings {
  return {
    id: row.id as number,
    hotkey: row.hotkey as string,
    obsidianPath: row.obsidian_path as string,
    inboxFolder: row.inbox_folder as string,
    theme: (row.theme as ThemeMode) || 'brass',
    autoStart: (row.auto_start as number) === 1,
  };
}

export async function createItem(request: CreateItemRequest): Promise<Item> {
  const database = await getDb();
  const now = Date.now();

  const result = await database.execute(
    `INSERT INTO items (content, content_type, title, url, image_path, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [
      request.content,
      request.contentType,
      request.title || '',
      request.url || '',
      request.imagePath || '',
      now
    ]
  );

  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM items WHERE id = ?',
    [result.lastInsertId]
  );
  return mapItem(rows[0]);
}

export async function getItems(status?: ItemStatus): Promise<Item[]> {
  const database = await getDb();
  if (status) {
    const rows = await database.select<Record<string, unknown>[]>(
      'SELECT * FROM items WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return rows.map(mapItem);
  }
  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM items ORDER BY created_at DESC'
  );
  return rows.map(mapItem);
}

export async function updateItemContent(id: number, content: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE items SET content = ? WHERE id = ?',
    [content, id]
  );
}

export async function updateItemStatus(id: number, status: ItemStatus): Promise<void> {
  const database = await getDb();
  const pushedAt = status === 'pushed' ? Date.now() : 0;
  await database.execute(
    'UPDATE items SET status = ?, pushed_at = ? WHERE id = ?',
    [status, pushedAt, id]
  );
}

export async function deleteItem(id: number): Promise<void> {
  const database = await getDb();

  // 先读取条目，获取关联的图片路径
  const rows = await database.select<Record<string, unknown>[]>(
    "SELECT image_path FROM items WHERE id = ?",
    [id]
  );

  if (rows.length > 0) {
    const imagePath = (rows[0].image_path as string) || "";
    if (imagePath) {
      const dir = await appLocalDataDir();
      const files = imagePath.split(";").map((s) => s.trim()).filter(Boolean);
      for (const file of files) {
        try {
          await remove(dir + file);
        } catch {
          // 文件可能已被删除，忽略错误
        }
      }
    }
  }

  await database.execute("DELETE FROM items WHERE id = ?", [id]);
}

export async function getItemById(id: number): Promise<Item | null> {
  const database = await getDb();
  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM items WHERE id = ?',
    [id]
  );
  if (!rows || rows.length === 0) return null;
  return mapItem(rows[0]);
}

export async function getSettings(): Promise<Settings> {
  const database = await getDb();
  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM settings WHERE id = 1'
  );
  return mapSettings(rows[0]);
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const database = await getDb();

  // 先读取当前值
  let current = await getSettings();

  // 合并设置
  const merged = {
    ...current,
    ...settings,
  };

  await database.execute(
    `UPDATE settings SET
      hotkey = ?,
      obsidian_path = ?,
      inbox_folder = ?,
      theme = ?,
      auto_start = ?
    WHERE id = 1`,
    [
      merged.hotkey,
      merged.obsidianPath,
      merged.inboxFolder,
      merged.theme,
      merged.autoStart ? 1 : 0,
    ]
  );
  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM settings WHERE id = 1'
  );
  return mapSettings(rows[0]);
}