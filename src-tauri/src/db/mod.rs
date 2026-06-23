pub mod migrations;

use std::path::PathBuf;

/// 使用 rusqlite 直接连接 SQLite 数据库（用于后端直接操作）
pub fn connect(app_data_dir: &PathBuf) -> Result<rusqlite::Connection, String> {
    let db_path = app_data_dir.join("inboxtray.db");
    rusqlite::Connection::open(&db_path).map_err(|e| format!("数据库连接失败: {}", e))
}
