use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: i64,
    pub content: String,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "imagePath")]
    pub image_path: String,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "pushedAt")]
    pub pushed_at: i64,
}
