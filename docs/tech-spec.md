# 技术规范 — 历史粘贴板 v1.0

## 一、技术栈

### 核心框架

| 层 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 桌面框架 | Electron | 34.x | 跨平台桌面壳 |
| UI 层 | HTML5 + CSS3 + Vanilla JS | — | 不使用 React/Vue 等重框架，控制体积和复杂度 |
| 打包 | electron-builder | 25.x | 生成 Windows .exe 安装包 |
| 包管理 | npm | — | Node.js 包管理器 |

### 关键依赖

| 包名 | 用途 |
|------|------|
| `electron` | 桌面框架核心 |
| `electron-builder` | 打包/安装包生成 |
| `better-sqlite3` | 本地 SQLite 数据库（无需安装数据库引擎） |
| `sharp` | 图片缩略图生成 |

### 开发工具

| 工具 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| Git | 版本控制 |
| GitHub | 代码托管 |

## 二、架构设计

### 进程模型（Electron 标准双进程）

```
┌─────────────────────────────────────┐
│  Main Process (Node.js)             │
│  - 剪贴板监控                       │
│  - 系统托盘                         │
│  - 全局快捷键注册                   │
│  - 数据库读写                       │
│  - 自动清理定时器                   │
│  - 开机自启管理                     │
│  - IPC 通信枢纽                     │
└──────────────┬──────────────────────┘
               │ IPC (contextBridge)
┌──────────────┴──────────────────────┐
│  Renderer Process (Chromium)        │
│  - UI 渲染                          │
│  - 搜索交互                         │
│  - 卡片列表展示                     │
│  - 设置面板                         │
│  - 主题切换                         │
└─────────────────────────────────────┘
```

### 目录结构

```
历史粘贴/
├── package.json            # 项目配置 & 依赖
├── CLAUDE.md               # 工作指引
├── docs/                   # 标准文档
│   ├── requirements.md
│   ├── tech-spec.md
│   ├── design-spec.md
│   └── implementation-plan.md
├── devlog/                 # 开发日志
│   └── YYYY-MM-DD.md
├── src/
│   ├── main/               # 主进程代码
│   │   ├── index.js        # 入口：窗口创建、托盘、快捷键
│   │   ├── clipboard.js    # 剪贴板监控模块
│   │   ├── database.js     # SQLite 数据库操作
│   │   ├── cleaner.js      # 自动清理过期记录
│   │   ├── autostart.js    # 开机自启管理
│   │   └── ipc-handlers.js # IPC 通信处理
│   ├── renderer/           # 渲染进程代码
│   │   ├── index.html      # 主页面
│   │   ├── style.css       # 样式
│   │   ├── app.js          # 主逻辑：列表、搜索、操作
│   │   ├── settings.js     # 设置面板逻辑
│   │   ├── theme.js        # 主题管理
│   │   └── components/     # UI 组件
│   │       ├── card.js     # 卡片组件
│   │       ├── search.js   # 搜索框组件
│   │       └── modal.js    # 弹窗组件
│   └── preload.js          # preload 脚本（安全桥接）
├── assets/                 # 静态资源
│   ├── icon.ico            # 应用图标
│   └── tray-icon.png       # 托盘图标
└── build/                  # 打包配置
    └── builder.json
```

## 三、数据存储——SQLite 数据库

**设计原则：** 图片本身不存数据库，存文件路径。数据库只存元数据。

### 表结构

```sql
CREATE TABLE clipboard_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,  -- 'text' | 'image'
    content     TEXT,              -- 文字内容（type='text'时）
    image_path  TEXT,              -- 图片文件路径（type='image'时）
    thumbnail   TEXT,              -- 缩略图路径
    pinned      INTEGER DEFAULT 0, -- 是否置顶 0/1
    created_at  TEXT    NOT NULL,  -- ISO 8601 时间戳
    source_app  TEXT               -- 来源应用名（可选）
);

CREATE INDEX idx_type ON clipboard_history(type);
CREATE INDEX idx_created ON clipboard_history(created_at DESC);
CREATE INDEX idx_pinned ON clipboard_history(pinned);
```

### 数据文件位置

- 数据库文件：`%APPDATA%/history-clipboard/data.db`
- 图片文件：`%APPDATA%/history-clipboard/images/{id}.png`
- 缩略图：`%APPDATA%/history-clipboard/thumbnails/{id}.jpg`
- 用户设置：`%APPDATA%/history-clipboard/settings.json`

## 四、IPC 通信接口

主进程暴露给渲染进程的 API（通过 contextBridge）：

```
window.clipboardAPI = {
    // 历史记录
    getHistory(search, limit, offset)  → Promise<Array>
    pinItem(id, pinned)               → Promise<void>
    deleteItem(id)                     → Promise<void>
    clearAll()                         → Promise<void>
    copyToClipboard(id)               → Promise<void>

    // 设置
    getSettings()                      → Promise<Object>
    saveSettings(settings)            → Promise<void>

    // 事件监听
    onNewClipboardItem(callback)      → void
    removeListener(channel)           → void
}
```

## 五、剪贴板监控机制

1. 使用 `setInterval` 轮询 `clipboard.readText()` / `clipboard.readImage()`
2. 轮询间隔：500ms（平衡响应性和 CPU 占用）
3. 内容比对：与上一次记录比对，相同则跳过
4. 图片比对：通过 Buffer hash 比对（MD5），避免存重复图片

## 六、自动清理机制

- 触发时机：应用启动时 + 每 12 小时
- 清理逻辑：`DELETE FROM clipboard_history WHERE pinned=0 AND created_at < datetime('now', '-N days')`
- 同时删除对应的图片文件和缩略图

## 七、开机自启

- 使用 `electron` 内置的 `app.setLoginItemSettings()` API
- 写入 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 注册表
