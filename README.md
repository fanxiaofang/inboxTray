# InboxTray — 桌面临时收件篮

轻量级 Windows 桌面工具，介于「剪贴板」和「笔记软件」之间，用于快速捕获临时想法、链接和图片，后续可按需推送到 Obsidian 整理。

> 先收集，再处理（GTD 收集阶段）

## 功能

- 全局快捷键呼出（默认 `Ctrl+Alt+Q`，可自定义）
- 快速输入文字，`Ctrl+Enter` 保存
- 粘贴链接，自动抓取页面标题和描述
- 粘贴图片（支持 Snipaste），自动压缩至 1920px / 2MB，单条最多 5 张
- 内容列表，按时间倒序，支持 pending / pushed / done 状态筛选
- 单条推送为独立 .md 文件到 Obsidian Inbox
- 四种主题（黄铜暗色 / 亮色 / 石板 / 森林）
- 图片灯箱、复选框交互
- 系统托盘常驻、开机自启动

## 配置 & 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Alt+Q` | 呼出快捷小窗（可在设置页自定义） |
| `Ctrl+Enter` | 保存输入 |
| `Esc` | 关闭窗口 |

在设置页可修改快捷键、Obsidian 仓库路径、Inbox 文件夹名及主题。

## 数据存储

所有数据仅存于本地 `%APPDATA%/com.inbox-tray.app/`（SQLite + 图片附件 + 日志），推送 Obsidian 也仅写入本地仓库，**不上传任何服务器**。

## 下载安装

### 方式一：安装包（推荐）

双击安装，自动处理 WebView2 依赖。

- `InboxTray_0.1.0_x86-setup.exe` — NSIS 安装包，有安装引导界面
- `InboxTray_0.1.0_x86_en-US.msi` — MSI 安装包，适合企业批量部署

### 方式二：便携版

解压即用，无需安装。

1. 下载 `InboxTray_0.1.0_x86_Portable.zip` 并解压
2. 双击 `启动 InboxTray.bat`
3. 首次运行会自动安装 WebView2 Runtime（需联网，后续秒开）

> **系统要求**：Windows 10 1803+ / Windows 11（x86 架构）

## 从源码构建

### 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)（含 `i686-pc-windows-msvc` target）
  ```bash
  rustup target add i686-pc-windows-msvc
  ```
- [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 或 Visual Studio（含 C++ 工具链）

### 构建

```bash
npm install
npm run tauri dev       # 开发模式（热更新）
npm run tauri build     # 构建安装包（产物在 src-tauri/target/i686-pc-windows-msvc/release/bundle/）
```

### 打包便携版

```bash
./scripts/package-portable.bat
```

## 技术栈

Tauri v2 + React 19 + TypeScript 5.8 + Tailwind CSS v4 + SQLite（i686-pc-windows-msvc）

## License

MIT
