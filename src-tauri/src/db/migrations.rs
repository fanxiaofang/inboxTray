use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
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
                );

                CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
                CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);

                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    hotkey TEXT NOT NULL DEFAULT 'Ctrl+Alt+Q',
                    obsidian_path TEXT DEFAULT '',
                    inbox_folder TEXT NOT NULL DEFAULT 'Inbox',
                    main_window_width INTEGER DEFAULT 420,
                    main_window_height INTEGER DEFAULT 640,
                    quick_input_width INTEGER DEFAULT 380,
                    quick_input_height INTEGER DEFAULT 220,
                    theme TEXT NOT NULL DEFAULT 'brass',
                    auto_start INTEGER NOT NULL DEFAULT 0
                );

                INSERT OR IGNORE INTO settings (id) VALUES (1);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_auto_start_column",
            sql: r#"
                ALTER TABLE settings ADD COLUMN auto_start INTEGER NOT NULL DEFAULT 0;
            "#,
            kind: MigrationKind::Up,
        },
    ]
}
