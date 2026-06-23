use crate::models::item::Item;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, thiserror::Error)]
pub enum ObsidianError {
    #[error("Obsidian path not configured")]
    PathNotConfigured,
    #[error("Invalid Obsidian path: {0}")]
    InvalidPath(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for ObsidianError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// 去掉第一行的 markdown 列表/复选框前缀（- [ ] , - [x] , - ），
/// 返回纯文本内容用于生成文件名
fn strip_markdown_prefix(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("- [ ] ")
            .or_else(|| trimmed.strip_prefix("- [x] "))
            .or_else(|| trimmed.strip_prefix("- [X] "))
            .or_else(|| trimmed.strip_prefix("- "))
        {
            return rest.trim().to_string();
        }
        // 普通文本直接返回
        return trimmed.to_string();
    }
    String::new()
}

/// 将 imagePath 字段（; 分隔）拆为文件名列表
fn split_image_paths(image_path: &str) -> Vec<&str> {
    image_path
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect()
}

#[tauri::command]
pub async fn push_to_obsidian(
    app_handle: tauri::AppHandle,
    item: Item,
    obsidian_path: String,
    inbox_folder: String,
) -> Result<String, ObsidianError> {
    if obsidian_path.is_empty() {
        return Err(ObsidianError::PathNotConfigured);
    }

    let vault_path = PathBuf::from(&obsidian_path);
    if !vault_path.exists() {
        return Err(ObsidianError::InvalidPath(obsidian_path));
    }

    let inbox_path = vault_path.join(&inbox_folder);
    fs::create_dir_all(&inbox_path)?;

    // 复制 AppLocalData 中的所有图片到 inbox/attachments/ 子目录
    let attachments_path = inbox_path.join("attachments");
    let image_names = split_image_paths(&item.image_path);
    let mut copied_images: Vec<String> = Vec::new();

    if !image_names.is_empty() {
        fs::create_dir_all(&attachments_path)?;
        let app_local_data = app_handle
            .path()
            .app_local_data_dir()
            .map_err(|e| ObsidianError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string())))?;

        for name in &image_names {
            let src = app_local_data.join(name);
            if src.exists() {
                let dst = attachments_path.join(name);
                fs::copy(&src, &dst)?;
                copied_images.push(name.to_string());
            }
        }
    }

    // 文件名：优先用 title → content → 图片/链接 fallback，限制 50 字
    let stripped = strip_markdown_prefix(&item.content);
    let name_source: &str = if !item.title.is_empty() {
        &item.title
    } else if !stripped.is_empty() {
        &stripped
    } else if !item.image_path.is_empty() {
        "图片"
    } else if item.content_type == "link" {
        "链接"
    } else {
        "untitled"
    };
    let name_summary: String = name_source.chars().take(50).collect();

    let timestamp = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let safe_summary = sanitize_filename(&name_summary);
    let base_filename = format!("{}_{}.md", timestamp, safe_summary);
    let mut file_path = inbox_path.join(&base_filename);

    // 去重：若同名文件存在，追加 -1、-2...直到唯一
    let stem = format!("{}_{}", timestamp, safe_summary);
    let mut counter: u32 = 1;
    while file_path.exists() {
        let new_filename = format!("{}-{}.md", stem, counter);
        file_path = inbox_path.join(&new_filename);
        counter += 1;
    }

    let markdown_content = generate_markdown(&item, &copied_images);

    fs::write(&file_path, markdown_content)?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn validate_obsidian_path(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);
    Ok(path.exists() && path.is_dir())
}

fn generate_markdown(item: &Item, copied_images: &[String]) -> String {
    let mut content = String::new();

    // YAML frontmatter
    content.push_str("---\n");
    content.push_str("source: InboxTray\n");
    content.push_str(&format!("created: {}\n", format_timestamp(item.created_at)));
    if !item.url.is_empty() {
        content.push_str(&format!("url: {}\n", item.url));
    }
    content.push_str("---\n\n");

    // 正文内容
    if !item.content.is_empty() {
        // 纯链接类型：content 来自 og:description，用引用块展示
        if item.content_type == "link" && !item.url.is_empty() {
            content.push_str(&format!("> {}\n\n", item.content));
        } else {
            content.push_str(&item.content);
            content.push_str("\n\n");
        }
    }

    // 链接参考
    if !item.url.is_empty() {
        content.push_str(&format!("📎 Source: [{}]({})\n",
            if !item.title.is_empty() { &item.title } else { &item.url },
            item.url
        ));
    }

    // 图片
    for name in copied_images {
        content.push_str(&format!("\n![[attachments/{}]]\n", name));
    }

    if copied_images.is_empty() && !item.image_path.is_empty() {
        content.push_str("\n> ⚠️ 图片文件未找到（共 ");

        let count = split_image_paths(&item.image_path).len();
        content.push_str(&count.to_string());
        content.push_str(" 张）\n");
    }

    content
}

fn format_timestamp(ts: i64) -> String {
    let dt = chrono::DateTime::from_timestamp_millis(ts);
    match dt {
        Some(dt) => dt.format("%Y-%m-%dT%H:%M:%S").to_string(),
        None => String::new(),
    }
}

fn sanitize_filename(input: &str) -> String {
    let sanitized: String = input
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | ' ' | '\n' | '\r' | '\t' => '_',
            c => c,
        })
        .collect();
    collapse_underscores(sanitized.trim()).to_string()
}

/// 压缩连续的下划线为单个
fn collapse_underscores(input: &str) -> String {
    let mut result = String::new();
    let mut prev_underscore = false;
    for c in input.chars() {
        if c == '_' {
            if !prev_underscore {
                result.push('_');
                prev_underscore = true;
            }
        } else {
            result.push(c);
            prev_underscore = false;
        }
    }
    result
}
