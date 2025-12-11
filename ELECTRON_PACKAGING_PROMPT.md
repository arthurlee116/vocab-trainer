# Electron 桌面应用打包实施指南

本文档为 AI 助手提供完整的实施指南，将现有 React + Express + SQLite 全栈 Web 应用打包成 macOS 桌面应用。

---

## 一、项目概述

### 1.1 当前技术栈

| 层级 | 技术 | 位置 |
|------|------|------|
| 前端 | React 19 + TypeScript + Vite 7 | `client/` |
| 后端 | Express 5 + better-sqlite3 | `server/` |
| 数据库 | SQLite | `server/storage/vocab.db` |
| AI 调用 | OpenRouter API（Gemini 2.5 Flash） | `server/src/services/openrouter.ts` |
| 状态管理 | Zustand | `client/src/store/` |

### 1.2 目标产物

- **应用名称**：Vocab Trainer
- **目标平台**：仅 macOS
- **分发方式**：`.dmg` 安装包（无需签名公证）
- **更新机制**：手动下载新版本

---

## 二、架构设计

### 2.1 Electron 进程模型

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Tray Manager  │  │     Express Server          │  │
│  │   (托盘图标)     │  │     (API :4000)             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Window Manager │  │     Proxy Detector          │  │
│  │  (窗口状态持久化) │  │     (系统代理检测)          │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │ IPC
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Electron Renderer Process              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React SPA (Vite Build)              │   │
│  │              加载 client/dist/index.html         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户操作 → React UI → Axios → localhost:4000/api → Express → SQLite
                                                         ↓
                                              app.getPath('userData')/vocab.db
```

---

## 三、目录结构（新增）

```
vocab-new/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本（安全 IPC 桥接）
│   ├── tray.ts              # 托盘图标管理
│   ├── proxy.ts             # macOS 系统代理检测
│   ├── store.ts             # 窗口状态持久化（使用 electron-store）
│   ├── server.ts            # Express 服务启动器
│   └── icons/               # 图标目录（用户自备）
│       ├── icon.icns        # macOS 应用图标
│       └── trayTemplate.png # 托盘图标（16x16 或 22x22）
├── electron-builder.yml     # electron-builder 打包配置
├── client/                  # React 前端（保持不变）
├── server/                  # Express 后端（移除认证模块）
└── package.json             # 新增 electron 相关脚本和依赖
```

---

## 四、核心实现细节

### 4.1 主进程 (`electron/main.ts`)

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initTray } from './tray';
import { startServer } from './server';
import { WindowStore } from './store';
import { detectSystemProxy } from './proxy';

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;
const windowStore = new WindowStore();

const SERVER_PORT = 4000;

async function createWindow() {
  // 恢复窗口状态
  const windowState = windowStore.get();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset', // macOS 原生标题栏样式
    show: false, // 等待 ready-to-show
  });

  // 加载前端
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../client/dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 关闭时隐藏而非退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // 保存窗口状态
  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  windowStore.set({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
  });
}

app.whenReady().then(async () => {
  // 检测系统代理
  const proxyConfig = await detectSystemProxy();
  
  // 启动 Express 服务
  serverProcess = await startServer(SERVER_PORT, proxyConfig);
  
  // 创建窗口
  await createWindow();
  
  // 初始化托盘
  initTray(mainWindow!);
});

// macOS: 点击 dock 图标时重新显示窗口
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// 退出前清理
app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.close();
  }
});
```

### 4.2 系统代理检测 (`electron/proxy.ts`)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProxyConfig {
  httpProxy?: string;
  httpsProxy?: string;
}

export async function detectSystemProxy(): Promise<ProxyConfig> {
  try {
    const { stdout } = await execAsync('scutil --proxy');
    const config: ProxyConfig = {};

    // 解析 HTTPEnable 和 HTTPProxy/HTTPPort
    const httpEnabled = /HTTPEnable\s*:\s*1/.test(stdout);
    if (httpEnabled) {
      const hostMatch = stdout.match(/HTTPProxy\s*:\s*(\S+)/);
      const portMatch = stdout.match(/HTTPPort\s*:\s*(\d+)/);
      if (hostMatch && portMatch) {
        config.httpProxy = `http://${hostMatch[1]}:${portMatch[1]}`;
      }
    }

    // 解析 HTTPSEnable 和 HTTPSProxy/HTTPSPort
    const httpsEnabled = /HTTPSEnable\s*:\s*1/.test(stdout);
    if (httpsEnabled) {
      const hostMatch = stdout.match(/HTTPSProxy\s*:\s*(\S+)/);
      const portMatch = stdout.match(/HTTPSPort\s*:\s*(\d+)/);
      if (hostMatch && portMatch) {
        config.httpsProxy = `http://${hostMatch[1]}:${portMatch[1]}`;
      }
    }

    return config;
  } catch (error) {
    console.error('Failed to detect system proxy:', error);
    return {};
  }
}
```

### 4.3 托盘图标 (`electron/tray.ts`)

```typescript
import { Tray, BrowserWindow, app, nativeImage } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function initTray(mainWindow: BrowserWindow) {
  // macOS 托盘图标使用 Template 后缀会自动适配深色/浅色模式
  const iconPath = path.join(__dirname, 'icons', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  tray.setToolTip('Vocab Trainer');

  // 点击托盘图标：显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
```

### 4.4 窗口状态持久化 (`electron/store.ts`)

```typescript
import Store from 'electron-store';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export class WindowStore {
  private store: Store<{ windowState: WindowState }>;

  constructor() {
    this.store = new Store({
      defaults: {
        windowState: {
          width: 1200,
          height: 800,
        },
      },
    });
  }

  get(): WindowState {
    return this.store.get('windowState');
  }

  set(state: Partial<WindowState>) {
    const current = this.get();
    this.store.set('windowState', { ...current, ...state });
  }
}
```

### 4.5 Express 服务启动器 (`electron/server.ts`)

```typescript
import { app } from 'electron';
import path from 'path';

interface ProxyConfig {
  httpProxy?: string;
  httpsProxy?: string;
}

export async function startServer(port: number, proxyConfig: ProxyConfig) {
  // 设置数据库路径为用户数据目录
  const userDataPath = app.getPath('userData');
  process.env.DATABASE_PATH = path.join(userDataPath, 'vocab.db');
  
  // 设置代理（如果检测到）
  if (proxyConfig.httpProxy) {
    process.env.OPENROUTER_PROXY = proxyConfig.httpProxy;
  }
  
  // 设置默认 API Key
  if (!process.env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = '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';
  }
  
  // 动态导入 Express 服务
  const { createApp } = await import('../server/dist/index.js');
  const server = createApp();
  
  return new Promise((resolve) => {
    const instance = server.listen(port, () => {
      console.log(`Express server running on port ${port}`);
      resolve(instance);
    });
  });
}
```

---

## 五、认证系统改造

### 5.1 需要删除的文件

```
server/src/routes/auth.ts          # 整个删除
server/src/services/auth.ts        # 整个删除
server/src/middleware/auth.ts      # 整个删除（如果存在）
```

### 5.2 需要修改的文件

#### `client/src/store/useAuthStore.ts`

**改造前**：三种模式 `unauthenticated | guest | authenticated`

**改造后**：只保留本地模式，简化为：

```typescript
import { create } from 'zustand';

interface AuthState {
  initialized: boolean;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  initialize: () => set({ initialized: true }),
}));
```

#### `client/src/pages/LandingPage.tsx`

**改造**：移除登录/注册表单，直接重定向到 Dashboard

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);
  
  return null;
}
```

#### `client/src/components/AppLayout.tsx`

**改造**：
- 移除 `游客模式` / `已登录` 状态显示
- 移除 `登录账号` 按钮
- 移除 `退出登录` 按钮

#### `client/src/pages/DashboardPage.tsx`

**改造**：
- 移除 `authMode === 'guest'` 的警告提示
- 学习统计面板始终显示（移除 `authMode === 'authenticated'` 判断）

#### `client/src/pages/ReportPage.tsx`

**改造**：移除 `authMode === 'guest'` 的注册提示

#### `client/src/lib/progressService.ts`

**改造**：统一使用 SQLite 存储，移除 LocalStorage 逻辑

```typescript
// 所有函数移除 mode 判断，直接调用服务端 API
// 移除 LocalStorage 相关的 saveToLocalStorage / loadFromLocalStorage
// 移除 12 条记录限制
```

#### `client/src/pages/QuizPage.tsx`

**改造**：
- 移除 `saveAuthenticatedSession` 的条件判断
- 完成后直接保存到本地 SQLite

#### `server/src/routes/history.ts`

**改造**：
- 移除 JWT 认证中间件
- 移除 `mode: 'authenticated'` 的校验
- 所有请求视为本地用户（可用固定 userId 如 `'local-user'`）

---

## 六、API Key 设置界面

### 6.1 新增设置页面 (`client/src/pages/SettingsPage.tsx`)

```typescript
import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // 从 electron-store 读取用户自定义的 API Key
    window.electronAPI?.getApiKey().then(setApiKey);
  }, []);

  const handleSave = async () => {
    await window.electronAPI?.setApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page-section">
      <h1><Settings size={24} /> 设置</h1>
      <div className="form-group">
        <label>OpenRouter API Key（可选，留空使用默认）</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-v1-..."
        />
        <button onClick={handleSave}>
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}
```

### 6.2 Preload 脚本 (`electron/preload.ts`)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key: string) => ipcRenderer.invoke('set-api-key', key),
});
```

### 6.3 主进程 IPC 处理

```typescript
// 在 main.ts 中添加
import Store from 'electron-store';

const settingsStore = new Store();

ipcMain.handle('get-api-key', () => {
  return settingsStore.get('customApiKey', '');
});

ipcMain.handle('set-api-key', (_, key: string) => {
  settingsStore.set('customApiKey', key);
  // 更新环境变量
  if (key) {
    process.env.OPENROUTER_API_KEY = key;
  }
});
```

---

## 七、代码清理清单

### 7.1 删除的文件/目录

```
# 测试相关
e2e/                                    # E2E 测试目录
client/src/__tests__/                   # 前端测试
client/src/**/__tests__/                # 所有嵌套测试目录
server/src/**/__tests__/                # 后端测试
playwright.config.ts                    # Playwright 配置
client/vitest.config.ts                 # 前端测试配置
server/vitest.config.ts                 # 后端测试配置（如果存在）
test-results/                           # 测试结果
e2e-results/                            # E2E 结果
client/test-results/                    # 前端测试结果
client/coverage/                        # 覆盖率报告

# CI/CD 和文档
.github/                                # GitHub Actions
.qoder/                                 # AI 工具配置
.trae/                                  # AI 工具配置
Docs/                                   # 文档目录
AGENTS.md                               # AI 协作文档
CLAUDE.md                               # Claude 指南
PROJECT_BOARD.md                        # 项目看板
E2E_IMPLEMENTATION_REPORT.md            # E2E 报告
E2E_TEST_IMPLEMENTATION_PROMPT.md       # E2E 提示词
.env.example                            # 环境变量模板

# 其他
ExtractTest/                            # 实验目录
OpenRouter Files/                       # 临时文件
vocab-quiz/                             # 旧目录（如果是废弃的）
```

### 7.2 保留的目录

```
.kiro/                                  # 保留（用户要求）
.vscode/                                # 保留（编辑器配置）
.git/                                   # 保留（版本控制）
```

---

## 八、依赖变更

### 8.1 根目录 `package.json` 新增

```json
{
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "@electron/rebuild": "^3.6.0"
  },
  "dependencies": {
    "electron-store": "^10.0.0"
  },
  "scripts": {
    "electron:dev": "concurrently \"npm run dev:client\" \"npm run dev:server\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "postinstall": "electron-builder install-app-deps"
  },
  "main": "electron/dist/main.js"
}
```

### 8.2 移除的依赖

```json
{
  "devDependencies": {
    "@playwright/test": "移除",
    "vitest": "移除",
    "@vitest/coverage-v8": "移除",
    "@testing-library/react": "移除",
    "@testing-library/jest-dom": "移除",
    "@testing-library/user-event": "移除",
    "jsdom": "移除"
  },
  "dependencies": {
    "jsonwebtoken": "移除",
    "bcryptjs": "移除",
    "@types/jsonwebtoken": "移除",
    "@types/bcryptjs": "移除"
  }
}
```

---

## 九、electron-builder 配置

### `electron-builder.yml`

```yaml
appId: com.vocabtrainer.app
productName: Vocab Trainer
copyright: Copyright © 2025

mac:
  category: public.app-category.education
  icon: electron/icons/icon.icns
  target:
    - target: dmg
      arch:
        - x64
        - arm64

dmg:
  title: Vocab Trainer
  iconSize: 100
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

files:
  - electron/dist/**/*
  - client/dist/**/*
  - server/dist/**/*
  - "!**/__tests__/**"
  - "!**/node_modules/**/{test,tests,__tests__}/**"

extraResources:
  - from: server/storage/
    to: storage/
    filter:
      - "!*.db"  # 不打包数据库文件，运行时创建

asar: true

# 重编译原生模块
electronCompile: false
npmRebuild: true
```

---

## 十、构建和运行命令

```bash
# 安装依赖
npm install

# 重编译 better-sqlite3（针对 Electron）
npx @electron/rebuild

# 开发模式（三个进程并行）
npm run electron:dev

# 生产构建
npm run build              # 编译 TypeScript
npm run electron:build     # 打包成 .dmg

# 产物位置
dist/Vocab Trainer-{version}.dmg
```

---

## 十一、实施步骤建议

1. **创建 electron 目录结构**
2. **安装 Electron 相关依赖**
3. **实现主进程和预加载脚本**
4. **实现系统代理检测**
5. **实现托盘和窗口管理**
6. **移除认证系统**（删除文件 + 修改相关组件）
7. **修改 progressService 统一使用 SQLite**
8. **添加设置页面**（API Key 配置）
9. **清理测试和文档文件**
10. **配置 electron-builder**
11. **测试开发模式**
12. **测试生产构建**
13. **验证 .dmg 安装和运行**

---

## 十二、注意事项

1. **better-sqlite3 原生模块**：必须用 `@electron/rebuild` 针对 Electron 版本重编译，否则会报 `NODE_MODULE_VERSION` 不匹配错误

2. **前端 API 请求**：确保 `VITE_API_BASE_URL` 在打包后指向 `http://localhost:4000/api`

3. **数据库路径**：使用 `app.getPath('userData')` 确保数据持久化在用户目录，卸载应用不会丢失数据

4. **托盘图标**：macOS 要求使用 Template 图标（文件名包含 `Template`），会自动适配深色/浅色模式

5. **代码签名**：当前配置不包含签名，首次运行需要用户在系统偏好设置中允许

6. **CORS**：本地应用不需要 CORS 配置，可以移除 `CLIENT_ORIGINS` 相关代码

7. **端口冲突**：如果 4000 端口被占用，考虑使用 `portfinder` 动态分配端口
