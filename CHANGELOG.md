# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。
版本号格式：语义化版本 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.1.2] - 2026-08-20

### Changed
- 清理 8 个 Rust 编译警告：删除无用 import（`crypto.rs` 的 `zeroize::Zeroize`、`estimate.rs` 的 `is_already_compressed`）与死代码（`kdf.rs` 的 `zeroize_bytes`、`hmac.rs` 的 `compute_hmac`、`crypto.rs` 的 `NONCE_SIZE`、`split.rs` 的 `DEFAULT_CHUNK_SIZE`）；`estimate_encrypted_size` 的 `compress_level`/`filename` 参数改为下划线前缀保留 API 签名

## [1.1.1] - 2026-08-20

### Added
- **加密大小估算接入 WASM**：`estimate_encrypted_size` 原生估算替代前端近似公式（公式仅作 WASM 不可用时的回退）

### Fixed
- **auto 模式估算偏差**：估算无法预知内容熵，auto 模式改为按不压缩上界保守估算，不再低估实际加密大小（高熵数据实测偏差由 -30% 修正为 0%）

### Removed
- 删除未接线的死代码 `src/worker/batchWorker.ts`（批量加密由 `main.ts` 循环实现，功能不受影响）

## [1.1.0] - 2026-08-20

### Added
- **加密后分割 .part 分片**：加密完成时可按指定大小（MB）分割为多个 .partNN 分片下载；解密时选择全部 .part 文件自动合并

### Changed
- 整理项目文件：删除未引用的词表源文件、重复 manifest、构建临时文件

### Fixed
- 无

## [1.0.0] - 2026-08-20

### Added
- **Rust WASM 加密核心**（wasm/src/，12 个模块，46 个单元测试全部通过）：
  - `kdf.rs`：Argon2id + SHA-512 混合派生 + HKDF（encKey/hmacKey 分离）
  - `crypto.rs`：AES-256-GCM 1MB 分块加解密（独立随机 nonce）
  - `hmac.rs`：增量 HMAC-SHA256 完整性校验
  - `compress.rs`：zstd 压缩（级别 1-9，模式 开/关/自动）
  - `tar.rs`：ustar 多文件打包/解包（路径穿越防护）
  - `container.rs`：72 字节参数块 + 加密头部 JSON（无魔数，纯二进制）
  - `password.rs`：随机密码生成（8-64 位，排除易混淆字符）
  - `recovery.rs`：BIP39 恢复短语生成/校验（12/24 词，2048 词表）
  - `estimate.rs`：加密后大小估算
  - `split.rs`：文件分割/合并
- **前端终端 UI**（src/）：
  - 终端风格界面（黑底绿字、等宽字体）
  - 暗色/亮色主题切换（CSS 变量）
  - 中/英国际化（默认中文，i18n 全量接入 data-i18n）
  - 拖拽上传 + 移动端降级点击选择
  - 字符进度条 + 耗时统计
- **核心功能链路**：
  - 文本/单文件/多文件加密（tar 打包 + 压缩 + AES-GCM + HMAC）
  - 解密（密码错误静默 10 秒延迟报错，防时序攻击）
  - 多文件解密列表 + 逐个下载
  - SHA-256/SHA-512 哈希 + 期望值对比（MATCH/MISMATCH）
  - HMAC-SHA256 独立校验
  - 密码生成器（接入 WASM）
  - 恢复短语生成（第二因素）
  - 批量任务队列（多文件分别加密）
  - 一键清除（覆盖敏感变量 + 清剪贴板）
- **PWA**：manifest + 图标 + Service Worker 注册（离线可用）
- **构建**：`build.bat` 一键构建（自动检测/下载 wasm-pack、zig、wasm32 目标）

### Changed
- 无（初始版本）

### Fixed
- 无（初始版本）

### Security
- 密码学逻辑全部封装在 WASM（Rust），前端 JS 无算法实现
- 密钥派生加入时间因子与熵，抗暴力破解
- 错误密码统一延迟反馈，不泄露错误细节

## 版本历史说明

- 初始版本 [1.0.0] 对应 git 提交 `fcddcc9`
- 加密逻辑更新时将创建新仓库（按项目约定 S-ENC-001 无版本号，逻辑更新新建仓库）