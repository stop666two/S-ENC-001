# S-ENC-001 安全终端

> **S-ENC-001 SECURE TERMINAL** — 纯前端、完全离线的文件加密/解密工具，终端风格 UI。

S-ENC-001 是一个运行在浏览器中的加密工具箱：**Rust (wasm-bindgen) 加密核心 + TypeScript/Vite 前端**。所有加密运算均在本地完成，无任何网络请求，数据不出设备。

---

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 文件加密/解密 | 单文件、多文件（自动打包为 tar 后加密）、文本内容加密 |
| 大文件支持 | AES-256-GCM 按 1 MB 分块加密，可流式处理大文件 |
| 压缩 | zstd 压缩，级别 1–19（默认 5），模式：自动 / 开启 / 关闭 |
| 文件分割 | 超过设定大小自动分割为 `base.partNN` 分片下载，解密时选择全部分片自动合并 |
| 密钥派生 | Argon2id + HKDF-SHA512 派生加密/认证双密钥 |
| 多因素 | 可选 BIP39 恢复短语（助记词）、可选密钥文件（其哈希参与派生） |
| 密码生成器 | 长度/字符集可调的随机密码生成，可一键回填加密表单 |
| 终端日志 | 全程终端式日志（`>` / `[提示]` / `[错误]`），解密结果预览与下载列表 |
| 双语界面 | 中文 / English 即时切换并持久化，语言自动检测；检测页与免责声明页内也可切换 |
| 主题 | 自动（跟随系统）/ 浅色 / 深色 三态切换并持久化，刷新无闪烁 |
| PWA | 可安装、可离线运行（Service Worker），移动端适配 |
| 完全离线 | 零网络请求，WASM 模块本地加载 |

## 加密规格

| 项 | 规格 |
| --- | --- |
| 密钥派生 | Argon2id（内存 65536 KB / 迭代 3 / 并行 1）→ HKDF-SHA512 派生 enc / hmac 双密钥 |
| 对称加密 | AES-256-GCM，1 MB 分块（BLOCK_SIZE = 1048576，TAG_SIZE 16），块内 12 字节随机 nonce |
| 整体认证 | HMAC-SHA256 对整个容器计算，防篡改 |
| 压缩 | zstd（no_asm feature，wasm 兼容），级别 clamp 1–19 |
| 容器格式 | 72 字节 ParamBlock（salt 16 + entropy 16 + timestamp 8 + header_nonce 12 + header_tag 16 + header_len 4）+ JSON 加密头 + 密文 |
| KDF 输入 | 密码 + 可选 key_file_hash（32 B）+ 可选 recovery_phrase |
| 分割命名 | `base.partNN`（NN 按总分片数补零），单片上限 4095 MB |
| 多文件打包 | tar 归档（ustar 格式，字节级标准输出） |

> 加密产物扩展名为 `.enc`（文本加密默认 `text.enc`，可在加密表单中自定义文件名与后缀）。密文直接打开必然乱码——请使用本工具解密。解密下载时按容器内记录的原文件名恢复：文件加密恢复原文件名（含扩展名），文本加密恢复为 `text.txt`。

## 快速开始

### 方式一：一键启动（已有构建产物）

```bat
start.bat [port]
```

自动检测 Node.js / Python 3 运行时，服务 `dist/` 目录并打开浏览器（默认端口 4173）。

### 方式二：开发模式

```bat
npm install
npm run dev
```

### 方式三：手工构建

```bat
build.bat
```

一键完成：检查环境 → 安装/定位 wasm-pack → 安装 wasm32 目标 → 定位 zig/clang 包装脚本 → wasm-pack 编译 Rust 核心 → 同步到 `public/wasm/` → npm install → 前端构建。产物输出到 `dist/`。

分步构建（等价于 build.bat 核心步骤）：

```bash
# 1. Rust WASM 核心（需要 CC=tools/clang.cmd 环境）
cd wasm
wasm-pack build --target web --release
cd ..
# 2. 同步 wasm 产物到 public
xcopy /E /Y wasm/pkg/* public/wasm/
# 3. 前端构建（tsc 类型检查 + vite 打包 + service worker）
npm run build
```

### 部署

将 `dist/` 部署到任意静态服务器（Nginx / GitHub Pages / Vercel 等）。需正确提供 `application/wasm` MIME 类型（`serve.mjs` 已内置）。Service Worker 建议部署在 HTTPS 或 localhost 下使用。

## 测试

```bash
# Rust 单元测试（48 项，需 MinGW 链接器）
set PATH=%CD%/tools/winlibs/mingw64/bin;%PATH%
cargo test --manifest-path wasm/Cargo.toml

# 前端类型检查（tsc --noEmit 作为 build 第一步自动执行）
npm run build
```

## 项目结构

```
S-ENC-001/
├── wasm/                  # Rust 加密核心（s-enc-core，wasm-bindgen）
│   └── src/               # container / crypto / kdf / compress / tar / split / estimate / password / recovery / hmac / lib
├── src/                   # TypeScript 前端
│   ├── main.ts            # 应用入口与主流程
│   ├── worker/            # 加密/解密 Web Worker
│   ├── core/              # 下载 / 估算 / 剪贴板工具
│   ├── ui/                # 弹窗组件（密码 / 结果 / 确认 / 模式选择 / 短语 / 密码生成）
│   ├── styles/            # terminal.css（UI-STYLE.md 契约实现）
│   └── locales/           # zh-CN.json / en-US.json（146 key 双语对齐）
├── public/wasm/           # wasm-pack 产物（运行时加载）
├── scripts/build-sw.mjs   # Service Worker 构建（esbuild IIFE）
├── docs/UI-STYLE.md       # 界面风格规范（重构契约）
├── serve.mjs              # 零依赖静态服务器
├── start.bat              # 一键启动
├── build.bat              # 一键构建
└── CHANGELOG.md           # 变更日志（Keep a Changelog）
```

## 安全说明

- **密码不存储**：密码仅存在于内存中参与密钥派生，不落盘、不上传；表单偏好仅记忆压缩级别/模式/分割大小等非敏感项。
- **错误信息不泄露细节**：解密失败统一提示「密码错误或文件已损坏」；错误密码存在 10 秒静默延迟（防时序攻击，无任何提示日志）。
- **密钥用后清零**：Rust 核心在加密/解密结束后对派生密钥执行 zeroize 清零。
- **残留提醒**：加密/解密完成后建议安全擦除原始文件（磁盘残留不在本工具能力范围）。
- **离线优先**：应用无任何外部请求；请在可信环境中使用浏览器。
- 密钥文件参与派生（哈希后使用），加密与解密必须使用同一文件；恢复短语丢失无法找回，请妥善保管。

## 兼容性

- 构建环境：Windows（`build.bat` / `start.bat` 面向 Windows）；Rust ≥ 1.70、Node.js ≥ 18、wasm-pack、zig 0.16（自带 clang）
- 运行环境：现代浏览器（Chrome / Edge / Firefox / Safari，含移动端），需支持 WebAssembly、Web Worker、Crypto API
- 版本锁定：`package.json` 与 `wasm/Cargo.toml` 均锁定精确版本（无范围符），构建可复现

## 浏览器兼容性

启动时会自动检测浏览器能力。检测结果分两类：

| 类型 | 检测项 | 缺失时行为 |
| --- | --- | --- |
| 关键（硬性限制） | WebAssembly、Web Worker、Web Crypto API（crypto.subtle）、TextEncoder/TextDecoder | 阻止进入，显示缺失项与推荐浏览器安装指南 |
| 可选（软性警告） | Clipboard API、Service Worker | 仅提示，可关闭后继续使用（Clipboard 有 execCommand 兜底） |

推荐使用最新版 **Google Chrome**、**Mozilla Firefox** 或 **Microsoft Edge**（Windows 10/11 自带）。安装指南：

| 设备 | Chrome | Firefox | Edge |
| --- | --- | --- | --- |
| Windows 桌面 | https://www.google.com/chrome/ | https://www.mozilla.org/firefox/ | Windows 10/11 自带，或 https://www.microsoft.com/edge |
| macOS 桌面 | https://www.google.com/chrome/ | https://www.mozilla.org/firefox/ | https://www.microsoft.com/edge |
| Linux 桌面 | https://www.google.com/chrome/ | 多数发行版自带 | https://www.microsoft.com/edge |
| Android 手机/平板 | Google Play 搜索 Chrome | Google Play 搜索 Firefox | Google Play 搜索 Microsoft Edge |
| iPhone / iPad | App Store 搜索 Chrome | App Store 搜索 Firefox | App Store 搜索 Microsoft Edge |

> iOS 上所有浏览器（含 Chrome/Firefox/Edge）均基于 WebKit 内核，功能表现一致，安装任意一个即可。检测报告弹窗内置完整安装指引（含各平台官方链接）。

## 相关文档

- [界面风格规范 docs/UI-STYLE.md](docs/UI-STYLE.md) — 终端美学风格契约（重构时必须遵守）
- [免责声明 docs/DISCLAIMER.md](docs/DISCLAIMER.md) — 首次启动弹窗正文与完整条款（同意前不渲染界面；同意后每次刷新/一键清除，终端日志区顶部常驻协议全文）
- [构建计划 BUILD_PLAN.md](BUILD_PLAN.md) — 搭建阶段记录与关键技术决策
- [变更日志 CHANGELOG.md](CHANGELOG.md)