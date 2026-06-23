use crate::utils::http;

#[tauri::command]
pub async fn fetch_page_title(url: String) -> Result<Option<String>, String> {
    http::fetch_page_title(&url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_page_meta(url: String) -> Result<http::PageMeta, String> {
    http::fetch_page_meta(&url)
        .await
        .map_err(|e| e.to_string())
}
