use winreg::enums::*;
use winreg::RegKey;

const REGISTRY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_NAME: &str = "InboxTray";

/// 设置/取消开机自启动
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(REGISTRY_PATH)
        .map_err(|e| format!("无法打开注册表: {}", e))?;

    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("无法获取程序路径: {}", e))?;
        key.set_value(APP_NAME, &exe_path.to_string_lossy().to_string())
            .map_err(|e| format!("无法写入注册表: {}", e))?;
    } else {
        key.delete_value(APP_NAME).ok();
    }

    Ok(())
}

/// 检查当前是否已设置开机自启动
pub fn is_autostart_enabled() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey(REGISTRY_PATH)
        .map_err(|e| format!("无法打开注册表: {}", e))?;

    match key.get_value::<String, _>(APP_NAME) {
        Ok(_) => Ok(true),
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!("读取注册表失败: {}", e)),
    }
}
