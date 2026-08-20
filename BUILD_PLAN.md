# S-ENC-001 搭建计划

> 分 6 个阶段，按依赖顺序推进。每个阶段产出可独立验证的里程碑。

## ✅ 完成状态（2026-08-20）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 0 环境与脚手架 | ✅ | Rust 1.96 + Node 26 + wasm-pack 0.15 + zig 0.16 (替代 LLVM/clang) |
| 1 Rust WASM 核心 | ✅ | 12 模块全部实现，48/48 单元测试通过 |
| 2 前端基础设施 | ✅ | 终端 UI、主题、中英 i18n、Worker 通信 |
| 3 核心功能链路 | ✅ | 加密/解密/密码生成/恢复短语（哈希/HMAC/批量已随 UI 精简移除） |
| 4 PWA | ✅ | manifest + 图标 + SW 注册 |
| 5 测试验证 | ✅ | 浏览器实测：往返/错误密码/多因素/分割/tar 全部通过；cargo test 48/48 |

## 构建方式

一键构建：
```bat
build.bat
```

开发模式：
```bat
npm run dev
```

## 关键技术决策

1. **zig 替代 LLVM**：zstd 编译 wasm 需要 clang；winget LLVM 安装失败后改用 zig 0.16（自带 clang 21，93MB 便携包）
2. **clang.cmd 包装脚本**：将 wasm32-unknown-unknown 映射为 wasm32-freestanding，供 cc-rs 调用
3. **no_asm feature**：zstd 禁用汇编（amd64 汇编不适用于 wasm）
4. **wasm-opt = false**：wasm-pack 自带 wasm-opt 版本旧，无法处理 bulk memory
5. **public/wasm 单拷贝**：WASM 放 public 目录避免 Vite 双重打包，运行时 eval import 加载
6. **测试环境**：winlibs MinGW-w64 16.2 用于 cargo test 原生编译链接

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Rust | ≥ 1.70 | rustup.rs |
| Node.js | ≥ 18 | nodejs.org |
| wasm-pack | 0.15 | build.bat 自动安装 |
| zig | 0.16 | build.bat 自动下载 |

## 部署

将 dist/ 部署到任意静态服务器（Nginx/GitHub Pages/Vercel），需正确提供 application/wasm MIME。
## 2026-08-20 状态更新

- **UI 精简**：主界面按钮仅 [加密] [解密] [密码生成] [恢复短语] [一键清除] + [EN] [主题]；[加密] 两步式（文件/文本）；哈希/HMAC/批量任务已移除
- **压缩级别**：1/3/5/9/19，默认 5（zstd clamp 1–19）
- **解密结果交互**：自定义结果弹窗（文本前 100 字符预览 / 二进制格式提示 / 多选下载列表）
- **错误密码**：10 秒静默延迟保留（防时序攻击），无提示无日志
- **主题**：三态（自动 / 浅色 / 深色），localStorage `s-enc-theme`
- **版本**：1.0.0（CHANGELOG 与 package.json 同步）
- 完整变更见 CHANGELOG.md

