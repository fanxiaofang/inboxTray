use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PageMeta {
    pub title: Option<String>,
    pub description: Option<String>,
}

pub async fn fetch_page_title(url: &str) -> Result<Option<String>, reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("InboxTray/1.0")
        .build()?;

    let response = client.get(url).send().await?;
    let html = response.text().await?;
    
    let document = Html::parse_document(&html);
    let selector = Selector::parse("title").unwrap();
    
    Ok(document.select(&selector).next().map(|e| e.text().collect::<String>().trim().to_string()))
}

pub async fn fetch_page_meta(url: &str) -> Result<PageMeta, reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("InboxTray/1.0")
        .build()?;

    let response = client.get(url).send().await?;
    let html = response.text().await?;
    let document = Html::parse_document(&html);

    let title = Selector::parse("title")
        .ok()
        .and_then(|s| document.select(&s).next())
        .map(|e| e.text().collect::<String>().trim().to_string());

    let description = Selector::parse(r#"meta[property="og:description"]"#)
        .ok()
        .and_then(|s| document.select(&s).next())
        .and_then(|e| e.value().attr("content"))
        .map(|s| s.to_string())
        .or_else(|| {
            Selector::parse(r#"meta[name="description"]"#)
                .ok()
                .and_then(|s| document.select(&s).next())
                .and_then(|e| e.value().attr("content"))
                .map(|s| s.to_string())
        });

    Ok(PageMeta {
        title: title.filter(|t| is_valid_title(t)),
        description: description.filter(|d| is_valid_description(d)),
    })
}

fn is_valid_title(s: &str) -> bool {
    let t = s.trim();
    if t.is_empty() {
        return false;
    }
    let lower = t.to_lowercase();
    // 常见错误页标题 / 占位符
    const JUNK: [&str; 12] = [
        "not found",
        "404",
        "403",
        "500",
        "error",
        "未找到页面",
        "页面未找到",
        "页面不存在",
        "not found | opencode",
        "undefined",
        "null",
        "none",
    ];
    // 完全匹配或以常见错误标志开头
    if JUNK.iter().any(|j| lower == *j || lower.starts_with(j)) {
        return false;
    }
    // 包含明显的错误页关键词（如 "404 not found"）
    if (lower.contains("404") && lower.contains("not found"))
        || (lower.contains("404") && lower.contains("未找到"))
        || lower.contains("not found")
        || lower.contains("页面不存在")
    {
        return false;
    }
    true
}

fn is_valid_description(s: &str) -> bool {
    let t = s.trim();
    if t.is_empty() || t.len() < 5 {
        return false;
    }
    let lower = t.to_lowercase();
    // 常见占位符 / 无意义值
    let junk = [
        "description",
        "no description",
        "desc",
        "none",
        "undefined",
        "null",
        "website",
        "page",
        "home",
    ];
    !junk.contains(&lower.as_str())
}
