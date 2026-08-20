# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。
版本号格式：语义化版本 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.2.0] - 2026-08-20

### Added
- **start.bat 一键启动脚本**：检查 Node.js / Python 3 运行时（Windows 商店版 python 不可用时自动回退 `py` launcher），两者都可用时让用户选择 N/P 启动 dist 静态服务器并自动打开浏览器（默认端口 4173，可用第一个参数覆盖）
- **serve.mjs 零依赖静态服务器**：Node.js 直接服务 dist/ 目录，正确 MIME 类型（含 `application/wasm`）、404 兜底与路径穿越防护


## [1.1.2] - 2026-08-20

### Changed