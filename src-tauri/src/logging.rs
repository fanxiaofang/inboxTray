use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

static LOG_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);

/// 初始化日志系统：设置 panic hook 并确定日志文件路径
pub fn init(app_data_dir: PathBuf) {
    let log_path = app_data_dir.join("inboxtray.log");
    // 设置日志文件路径
    {
        let mut guard = LOG_FILE.lock().unwrap();
        *guard = Some(log_path.clone());
    }

    // 写入启动日志
    let _ = writeln_log(&format!(
        "=== InboxTray started at {} ===",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    ));

    // 设置自定义 panic hook
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let msg = format!("PANIC: {}", panic_info);
        let _ = writeln_log(&msg);
        // 同时输出到 stderr
        eprintln!("{}", msg);
        // 调用之前的 hook
        prev_hook(panic_info);
    }));
}

/// 写入一行日志（带时间戳）
pub fn writeln_log(line: &str) -> Result<(), String> {
    let guard = LOG_FILE.lock().map_err(|e| e.to_string())?;
    if let Some(path) = guard.as_ref() {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let entry = format!("[{}] {}\n", timestamp, line);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        file.write_all(entry.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 读取日志文件内容（用于前端查看）
pub fn read_log(app_data_dir: PathBuf) -> Result<String, String> {
    let log_path = app_data_dir.join("inboxtray.log");
    if log_path.exists() {
        fs::read_to_string(&log_path).map_err(|e| e.to_string())
    } else {
        Ok(String::from("日志文件不存在"))
    }
}

/// 清理旧日志（保留最近 1MB）
pub fn trim_log(app_data_dir: PathBuf) -> Result<(), String> {
    let log_path = app_data_dir.join("inboxtray.log");
    if !log_path.exists() {
        return Ok(());
    }
    let metadata = fs::metadata(&log_path).map_err(|e| e.to_string())?;
    if metadata.len() > 1024 * 1024 {
        // 超过 1MB 截断为最后 500KB
        let content = fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
        let len = content.len();
        let start = if len > 512 * 1024 { len - 512 * 1024 } else { 0 };
        let trimmed: String = content.chars().skip(start).collect();
        fs::write(&log_path, &trimmed).map_err(|e| e.to_string())?;
    }
    Ok(())
}
