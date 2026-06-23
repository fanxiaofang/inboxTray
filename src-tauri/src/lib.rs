mod commands;
mod db;
mod logging;
mod models;
mod utils;

use commands::{http, obsidian};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use utils::autostart;

/// 当前已注册的快捷键，供全局回调使用
static CURRENT_SHORTCUT: Mutex<Option<Shortcut>> = Mutex::new(None);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(move |_app, shortcut, event| {
            if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                return;
            }
            let current = CURRENT_SHORTCUT.lock().unwrap();
            if current.as_ref() == Some(shortcut) {
                // 使用 app handle 来调用 toggle
                if let Some(app_handle) = _app.app_handle().get_webview_window("quick-input").map(|w| w.app_handle().clone()) {
                    toggle_quick_input(&app_handle);
                }
            }
        }).build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 第二实例启动时，激活已有实例的主窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            #[cfg(desktop)]
            {
                // 初始化日志系统
                if let Ok(app_data_dir) = app.path().app_local_data_dir() {
                    logging::init(app_data_dir.clone());
                    let _ = logging::writeln_log("应用启动中...");

                    // 启动时自动检查数据库完整性
                    let _ = logging::writeln_log("正在检查数据库完整性...");
                    match crate::db::connect(&app_data_dir) {
                        Ok(db) => {
                            match db.prepare("PRAGMA integrity_check")
                                .and_then(|mut stmt| stmt.query_row([], |row| row.get::<_, String>(0)))
                            {
                                Ok(result) => {
                                    let _ = logging::writeln_log(&format!("数据库完整性: {}", result));
                                }
                                Err(e) => {
                                    let _ = logging::writeln_log(&format!("数据库完整性检查失败: {}", e));
                                }
                            }
                        }
                        Err(e) => {
                            let _ = logging::writeln_log(&format!("数据库连接失败: {}", e));
                        }
                    }
                }

                // 注册开机自启动
                let _ = autostart::set_autostart(true);
                let _ = logging::writeln_log("已注册开机自启动");

                setup_tray(app)?;

                // 注册默认快捷键（前端启动后会从数据库读取用户设置并替换）
                let _ = register_hotkey_inner(app.handle(), "Ctrl+Alt+Q");

                create_windows(app)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            obsidian::push_to_obsidian,
            obsidian::validate_obsidian_path,
            http::fetch_page_title,
            http::fetch_page_meta,
            register_hotkey,
            set_autostart,
            is_autostart_enabled,
            check_database_integrity,
            get_app_info,
            read_app_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
    use tauri::menu::{Menu, MenuItem};

    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "显示 InboxTray", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    // 使用配置中定义的托盘图标，附加菜单和事件处理
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu))?;
        tray.set_show_menu_on_left_click(true)?;
        tray.on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
        tray.on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
    }

    Ok(())
}

fn parse_hotkey(hotkey: &str) -> Option<(Option<Modifiers>, Code)> {
    let parts: Vec<&str> = hotkey.split('+').map(|s| s.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    let mut key_str = "";

    for part in &parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "meta" | "cmd" | "win" | "super" => modifiers |= Modifiers::META,
            _ => key_str = part,
        }
    }

    if key_str.is_empty() {
        return None;
    }

    let code = match key_str.to_uppercase().as_str() {
        "A" => Code::KeyA, "B" => Code::KeyB, "C" => Code::KeyC, "D" => Code::KeyD,
        "E" => Code::KeyE, "F" => Code::KeyF, "G" => Code::KeyG, "H" => Code::KeyH,
        "I" => Code::KeyI, "J" => Code::KeyJ, "K" => Code::KeyK, "L" => Code::KeyL,
        "M" => Code::KeyM, "N" => Code::KeyN, "O" => Code::KeyO, "P" => Code::KeyP,
        "Q" => Code::KeyQ, "R" => Code::KeyR, "S" => Code::KeyS, "T" => Code::KeyT,
        "U" => Code::KeyU, "V" => Code::KeyV, "W" => Code::KeyW, "X" => Code::KeyX,
        "Y" => Code::KeyY, "Z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2,
        "3" => Code::Digit3, "4" => Code::Digit4, "5" => Code::Digit5,
        "6" => Code::Digit6, "7" => Code::Digit7, "8" => Code::Digit8,
        "9" => Code::Digit9,
        "SPACE" => Code::Space,
        "ENTER" | "RETURN" => Code::Enter,
        "ESCAPE" | "ESC" => Code::Escape,
        "TAB" => Code::Tab,
        "BACKSPACE" => Code::Backspace,
        "DELETE" | "DEL" => Code::Delete,
        "UP" => Code::ArrowUp, "DOWN" => Code::ArrowDown,
        "LEFT" => Code::ArrowLeft, "RIGHT" => Code::ArrowRight,
        "F1" => Code::F1, "F2" => Code::F2, "F3" => Code::F3, "F4" => Code::F4,
        "F5" => Code::F5, "F6" => Code::F6, "F7" => Code::F7, "F8" => Code::F8,
        "F9" => Code::F9, "F10" => Code::F10, "F11" => Code::F11, "F12" => Code::F12,
        _ => return None,
    };

    Some((Some(modifiers), code))
}

/// 只负责注销旧快捷键 + 注册新快捷键，并更新共享状态。
/// 不触碰 on_shortcut 回调（回调只在 setup 中设置一次）。
#[cfg(desktop)]
fn register_hotkey_inner(app_handle: &tauri::AppHandle, hotkey: &str) -> Result<(), String> {
    let ext = app_handle.global_shortcut();

    // 只注销当前已注册的快捷键（而非 unregister_all）
    {
        let guard = CURRENT_SHORTCUT.lock().unwrap();
        if let Some(old) = *guard {
            let _ = ext.unregister(old);
        }
    }

    // 清空共享状态
    {
        let mut guard = CURRENT_SHORTCUT.lock().unwrap();
        *guard = None;
    }

    if hotkey.is_empty() {
        return Ok(());
    }

    let (modifiers, code) = parse_hotkey(hotkey)
        .ok_or_else(|| format!("无法解析快捷键: {hotkey}"))?;

    let shortcut = Shortcut::new(modifiers, code);
    ext.register(shortcut).map_err(|e| e.to_string())?;

    // 更新共享状态，供全局回调使用
    {
        let mut guard = CURRENT_SHORTCUT.lock().unwrap();
        *guard = Some(shortcut);
    }

    Ok(())
}

#[tauri::command]
fn register_hotkey(app_handle: tauri::AppHandle, hotkey: String) -> Result<(), String> {
    register_hotkey_inner(&app_handle, &hotkey)
}

// ============================================================
// 开机自启动
// ============================================================

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    autostart::set_autostart(enabled)
}

#[tauri::command]
fn is_autostart_enabled() -> Result<bool, String> {
    autostart::is_autostart_enabled()
}

// ============================================================
// 数据库完整性校验
// ============================================================

#[tauri::command]
fn check_database_integrity(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法获取数据目录: {}", e))?;

    let db_path = app_data_dir.join("inboxtray.db");
    if !db_path.exists() {
        return Ok("数据库文件不存在".to_string());
    }

    let db = crate::db::connect(&app_data_dir)?;
    let mut stmt = db
        .prepare("PRAGMA integrity_check")
        .map_err(|e| format!("校验准备失败: {}", e))?;

    let result: String = stmt
        .query_row([], |row| row.get(0))
        .map_err(|e| format!("完整性校验失败: {}", e))?;

    let _ = logging::writeln_log(&format!("数据库完整性校验结果: {}", result));

    Ok(result)
}

// ============================================================
// 应用信息（版本号、数据目录等）
// ============================================================

#[tauri::command]
fn get_app_info(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法获取数据目录: {}", e))?;

    let config = app_handle.config();
    let version = config.version.clone();

    Ok(serde_json::json!({
        "version": version,
        "dataDir": app_data_dir.to_string_lossy(),
        "name": "InboxTray",
        "author": "InboxTray Team",
        "license": "MIT",
        "repo": "https://github.com/inboxtray/inboxtray",
    }))
}

// ============================================================
// 读取日志文件
// ============================================================

#[tauri::command]
fn read_app_log(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法获取数据目录: {}", e))?;
    logging::read_log(app_data_dir)
}

fn toggle_quick_input(app_handle: &tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("quick-input") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg(desktop)]
fn create_windows(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let main_config = app.config().app.windows.iter()
        .find(|w| w.label == "main")
        .cloned()
        .unwrap_or_default();

    let quick_config = app.config().app.windows.iter()
        .find(|w| w.label == "quick-input")
        .cloned()
        .unwrap_or_default();

    let main_window = WebviewWindowBuilder::from_config(app, &main_config)?.build()?;

    WebviewWindowBuilder::from_config(app, &quick_config)?.build()?;

    // 首次启动时显示主窗口
    let _ = main_window.show();
    let _ = main_window.set_focus();

    Ok(())
}
