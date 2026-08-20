# S-ENC-001 界面风格规范（UI Style Guide）

> 本文档记录 S-ENC-001 界面**视觉与交互特点**（不含布局结构），供未来界面重构时保持风格一致。重构前请通读本文，并对照 src/styles/terminal.css、src/ui/ 源码逐项核对。

## 1. 设计基调

- **终端模拟器美学**：整个应用模拟命令行终端会话（经典绿屏/单色终端），这是产品身份核心，不是装饰。界面即终端：日志区是终端输出，按钮是终端命令，弹窗是终端表单。
- **极简克制**：无渐变、无阴影、无圆角（一律 1px 直角边框）、无图标库（用文字符号表达）、无页面级动画（仅 0.15–0.2s 的颜色过渡）。
- **一切通过日志叙述**：没有 toast / 通知气泡 / 成功弹窗，所有事件（收到文件、开始处理、完成、失败、下载）都以终端日志行呈现。
- **技术感文案**：文案直接、面向懂行用户，保留技术细节（KB 数字、算法名、SHA-256 前缀），不做过度的用户友好包装。
- **离线安全感**：界面明示「完全离线」；加密完成后主动提醒残留文件与安全擦除建议。

## 2. 色彩系统（CSS 变量）

所有颜色必须经 CSS 变量取用（见 terminal.css 顶部 :root / [data-theme]），禁止在组件内硬编码色值。

| 变量 | 深色（默认） | 浅色 | 语义 |
| --- | --- | --- | --- |
| --bg | #000 | #fff | 页面背景 |
| --text | #0f0（绿） | #000 | 正文、按钮文字 |
| --accent | #ff0（黄） | #00f | 强调：弹窗标题、进度、拖拽框、focus 框 |
| --error | #f00 | #c00 | 错误、危险按钮 |
| --dim | #0a0（暗绿） | #555 | 次要信息：状态栏、info 日志行、滚动条滑块 |
| --border | #0f0 | #000 | 全部 1px 边框 |
| --btn-hover-bg / --btn-hover-text | #0f0 / #000 | #000 / #fff | 按钮 hover 反色对 |

规则：
- **颜色即语义**：绿=正文与边框、黄=强调、红=错误/危险、暗绿=次要。不引入新颜色编码新含义，除非语义明确。
- 主题切换：html[data-theme=dark|light] 属性驱动，默认深色，持久化 localStorage 键 s-enc-theme，切换时 background/color 0.2s 过渡。
- 弹窗遮罩：深色 rgba(0,0,0,.7) / 浅色 rgba(255,255,255,.7)。

## 3. 字体与排版

- 等宽字体栈：JetBrains Mono, Courier New, monospace，不加载 web font，纯系统回退。
- 字号阶梯：基础 **14px**（正文/按钮/输入）；状态栏 **12px**；密码结果区 **16px**；窄屏（≤480px）正文 13px、状态栏 10px。
- 日志行高 1.6；标题 letter-spacing: 1px 加宽；按钮 text-transform: none（不做全大写强制）。
- 长文本（哈希、路径、密码）white-space: pre-wrap + word-break: break-all，允许断行不溢出。

## 4. 组件风格

### 按钮 .term-btn
- 透明背景 + 1px 实线边框 + 无圆角；侧边栏按钮左对齐文本。
- hover 反色（深色下绿底黑字），transition: background .15s, color .15s。
- focus-visible 2px accent outline；disabled 为 0.5 透明度 + not-allowed 光标。
- 危险按钮 .term-btn.danger：红字红边，hover 红底白字。

### 输入 .term-input（text/password/number）与 textarea
- 透明背景 + 1px 边框 + 继承等宽字体 + padding: 6px 8px，宽度 100%。
- 焦点态走全局 :focus { outline: 2px solid var(--accent) }。
- textarea：min-height 96px、resize: vertical、box-sizing: border-box。

### 弹窗 .modal
- 无圆角、1px 边框、背景同页面底色（不用卡片/阴影）；max-width 480px、width 90%；内容超高时内部滚动（max-height 90vh + overflow-y auto）。
- 标题用 accent 色；底部按钮组右对齐（.modal-actions）。
- 表单行：左侧标签列 + 右侧控件列，控件对齐成一条竖线。
- 密码生成器特色：滑块/复选框用 accent-color: var(--text)；生成的密码显示在 1px dashed accent 虚线框内（.password-result）。

### 其他
- 进度反馈：纯文案式（#progress-area 文字用 accent 色），无图形进度条。
- 滚动条：8px 宽，滑块用 --dim、hover 变 --text，轨道同背景色（WebKit 伪元素）。
- 整窗拖拽反馈：body.drag-over 时 outline: 3px dashed var(--accent)，outline-offset: -3px。

## 5. 文案与日志风格（i18n）

### 日志行前缀体系（中文文案）
| 前缀 | 用途 | 示例 |
| --- | --- | --- |
| >  | 动作/状态行 | > 加密中: RAMMap.zip (719.9 KB)、> 预估加密后大小: 508.0 KB |
| [提示]  | 提示 | [提示] 系统就绪 - 完全离线模式 |
| [错误]  | 错误 | [错误] 密码错误或文件已损坏 |
| [...]  | 等待/验证中 | [...] 验证中... |
|   [{i}]  | 列表项（两级缩进） |   [1] notes.txt (2.3 KB) |

### 其他文案惯例
- 按钮文字用方括号包住，终端命令感：[加密] [哈希] [HMAC 校验] [一键清除]；弹窗标题同款：[加密] 输入密码。
- 状态栏双段式：状态: 就绪/处理中 + 模式: 完全离线。
- 结果符号：✓ 一致 / ✗ 不一致（[提示] MATCH - 哈希一致 ✓）。
- 安全感知文案：解密失败统一输出「密码错误或文件已损坏」（不泄露具体失败原因）；处理前预告「密码错误将静默等待 10 秒」；完成后提醒「原始文件可能仍残留于磁盘，建议安全擦除」。
- 双语：扁平 key（约 105 个），data-i18n 属性 + I18nManager.apply() 全量应用；默认中文；localStorage 键 s-enc-lang 持久化；切换按钮显示**目标**语言（中文界面显示 EN）。

## 6. 交互行为特点

- 日志区自动滚底（scrollTop = scrollHeight），内存环形缓冲上限 500 行。
- 结果即时下载（自动触发下载，不弹保存框）；分割为多分片时每片间隔 300ms 依次触发，避免浏览器批量下载拦截。
- 错误密码防时序攻击：禁用密码输入框 + 静默等待 10 秒后才输出统一错误文案（设计文档 §3.5）。
- 处理中互斥（busy 态）：状态栏切「处理中」，期间阻止并发操作。
- 剪贴板自动化：哈希/HMAC/密码/恢复短语生成后自动复制，并输出 [提示] 已复制到剪贴板。
- 全键盘可达（原生表单控件），全局 :focus 高亮。

## 7. 可访问性与动效

- prefers-reduced-motion: reduce 下全部 transition 关闭。
- 提供 .sr-only 工具类。
- 动效预算：仅颜色过渡（按钮 hover .15s、主题切换 .2s），不引入位移/缩放/淡入淡出。

## 8. 品牌与元信息

- 页面标题 S-ENC-001 SECURE TERMINAL（大写英文品牌名）；界面内标题 S-ENC-001 安全终端。
- 启动屏：终端式三行 > Initializing S-ENC-001... / > Loading WASM crypto module... / > Please wait...，等宽 pre 居中。
- PWA：manifest.json + 192/512 图标 + Service Worker，可离线安装；meta theme-color #000000。
- 完全离线：无任何网络请求，WASM 由本地 public/wasm/ 动态加载。

## 9. 重构「风格契约」（必须保留）

无论用什么框架/组件库重构，以下契约不可破坏：

1. 色彩只能取自 --* 变量，语义映射（绿/黄/红/暗绿）不变。
2. 不引入圆角、阴影、渐变、emoji 图标、非等宽字体（除非产品决策明确推翻终端美学）。
3. 日志 > / [提示] / [错误] / [...] 前缀体系保留。
4. 所有用户可见文本必须走 data-i18n + i18n.t()，中英双语同步维护。
5. 动效预算：仅颜色过渡，≤0.2s。
6. 弹窗为直角无阴影终端表单；按钮为描边反色式。
7. 错误与安全文案沿用现语义（统一错误文案、10 秒静默、擦除提醒）。
