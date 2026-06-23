export type ContentType = 'text' | 'link' | 'image' | 'mixed';

export type ItemStatus = 'pending' | 'pushed' | 'done';

export interface Item {
  id: number;
  content: string;
  contentType: ContentType;
  title: string;
  url: string;
  imagePath: string;
  status: ItemStatus;
  createdAt: number;
  pushedAt: number;
}

export type ThemeMode = 'brass' | 'light' | 'slate' | 'forest';

export interface Settings {
  id: number;
  hotkey: string;
  obsidianPath: string;
  inboxFolder: string;
  theme: ThemeMode;
  autoStart: boolean;
}

export interface CreateItemRequest {
  content: string;
  contentType: ContentType;
  title?: string;
  url?: string;
  imagePath?: string;
}
