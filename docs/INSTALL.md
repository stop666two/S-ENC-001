# S-ENC-001 手动安装指南

本文档说明如何手动部署 S-ENC-001 到 **Windows / Linux / macOS** 三平台。S-ENC-001 是纯静态 Web 应用（构建产物为 `dist/` 目录），部署到任意静态文件服务器即可运行，无需数据库、无需后端进程。

---

## 0. 安装前须知

| 事项 | 说明 |
| --- | --- |
| 浏览器 | 现代浏览器（Chrome / Edge / Firefox / Safari，含移动端），需支持 WebAssembly、Web Worker、Crypto API |
| 访问方式 | **HTTPS 或 localhost**（Service Worker / PWA 安装功能受浏览器安全策略限制，仅在此两类地址下启用） |
| 静态服务器 | 必须正确返回 `application/wasm` MIME 类型（下面各方案均已包含处理方式） |
| 数据 | 应用零网络请求，全部加密运算在浏览器本地完成，无需任何服务端能力 |

---

## 1. 获取安装包

### 方式 A：从 GitHub Release 下载（推荐）

1. 打开仓库 Release 页面：`https://github.com/stop666two/S-ENC-001/releases`
2. 选择最新版本，下载 `dist-YYYY-MM-DD-HHMMSS.zip`（如 `dist-2026-08-21-143005.zip`）
3. 解压得到 `dist/` 目录，其中包含全部静态资源（`index.html`、`assets/`、`wasm/`、`sw.js`、`manifest.json`、图标）

> 每个 Release 均经过自动化构建（Rust wasm 编译 → 前端构建 → 主 JS 混淆）并打包，可直接部署。

### 方式 B：本地自行构建

Windows 环境运行 `build.bat`（自动检查/安装 wasm-pack、wasm32 target、zig，完成后输出 `dist/`）；或按 README「手工构建」章节执行各步骤。

---

## 2. Windows 手动安装

### 2.1 本地运行（最简单）

需要 Node.js ≥ 18 或 Python 3，将解压后的 `dist/` 放入项目目录（与 `serve.mjs`、`start.bat` 同级），运行：

```bat
start.bat          :: 默认端口 4173，自动选择 Node.js 或 Python
start.bat 8080     :: 指定端口
```

脚本自动打开 `http://localhost:4173/`。服务器在独立窗口运行，关闭该窗口即停止。

### 2.2 Nginx for Windows

1. 下载 Nginx Windows 版：`https://nginx.org/en/download.html`，解压到 `C:\nginx`
2. 编辑 `C:\nginx\conf\nginx.conf`，在 `http {}` 内新增：

```nginx
server {
    listen 80;
    server_name localhost;

    root D:/s-enc-001/dist;        # 改为你的 dist 路径
    index index.html;

    types {
        application/wasm wasm;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

3. 启动：双击 `C:\nginx\nginx.exe`（停止：`nginx.exe -s stop`，重载配置：`nginx.exe -s reload`）
4. 浏览器访问 `http://localhost/`

### 2.3 托管到任意静态服务

将 `dist/` 目录内容部署到 GitHub Pages、Vercel、Netlify、对象存储（OSS/S3）等任意静态托管。注意：

- 托管平台需支持 `.wasm` 文件返回 `application/wasm`（主流平台均支持；自建平台需在 MIME 配置中添加）
- 自定义域名需启用 HTTPS（各平台均提供免费证书）
- GitHub Pages 部署：将 `dist/` 内容推送到仓库 `gh-pages` 分支或使用 Actions 发布

---

## 3. Linux 手动安装

通用准备（以 `/var/www/s-enc-001/` 为例）：

```bash
sudo mkdir -p /var/www/s-enc-001
# 将解压后的 dist/ 内容复制到该目录（假设 zip 在 /tmp）
unzip /tmp/dist-2026-08-21-143005.zip -d /tmp/senc && sudo cp -r /tmp/senc/dist/* /var/www/s-enc-001/
sudo chown -R www-data:www-data /var/www/s-enc-001   # 视服务器用户调整
```

### 3.1 Nginx（推荐）

安装：Debian/Ubuntu `sudo apt install nginx`；Fedora/RHEL `sudo dnf install nginx`；Arch `sudo pacman -S nginx`。

新建站点配置 `/etc/nginx/sites-available/s-enc-001`（或 `/etc/nginx/conf.d/s-enc-001.conf`）：

```nginx
server {
    listen 80;
    server_name s-enc-001.example.com;   # 改为你的域名或 IP

    root /var/www/s-enc-001;
    index index.html;

    types {
        application/wasm wasm;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

启用并重启：

```bash
sudo ln -s /etc/nginx/sites-available/s-enc-001 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**HTTPS（启用 PWA 必需）**：安装 certbot 自动签发证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d s-enc-001.example.com
```

### 3.2 Caddy（自动 HTTPS）

安装：`sudo apt install caddy` 或从 `https://caddyserver.com/download` 下载。Caddyfile（`/etc/caddy/Caddyfile`）：

```
s-enc-001.example.com {
    root * /var/www/s-enc-001
    file_server
    encode gzip zstd
}
```

```bash
sudo systemctl restart caddy
```

Caddy 自动申请并续期 HTTPS 证书，无需额外配置。

### 3.3 轻量方案（临时 / 内网）

Python 3（内置 MIME 含 wasm，Python ≥ 3.11）：

```bash
cd /var/www/s-enc-001 && python3 -m http.server 4173
```

Node.js（使用仓库自带 `serve.mjs`，内置 `application/wasm` MIME）：

```bash
node serve.mjs 4173
```

> 以上两者默认只适合本机或可信内网临时使用（无 HTTPS，PWA 安装与离线缓存不生效）。

### 3.4 systemd 常驻服务（可选）

以 Node.js 版为例，`/etc/systemd/system/s-enc-001.service`：

```ini
[Unit]
Description=S-ENC-001 Static Server
After=network.target

[Service]
WorkingDirectory=/var/www/s-enc-001
ExecStart=/usr/bin/node /var/www/s-enc-001/serve.mjs 4173
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now s-enc-001
```

---

## 4. macOS 手动安装

### 4.1 安装 Homebrew 工具

```bash
brew install nginx        # 或 brew install caddy
```

### 4.2 Nginx

配置：`/opt/homebrew/etc/nginx/nginx.conf`（Apple Silicon）或 `/usr/local/etc/nginx/nginx.conf`（Intel），在 `http {}` 内新增与「3.1」相同的 server 块（`root` 改为你的 dist 路径），然后：

```bash
brew services start nginx
sudo certbot --nginx -d s-enc-001.example.com   # 可选：HTTPS
```

### 4.3 Caddy

Caddyfile 同「3.2」，默认路径 `/opt/homebrew/etc/Caddyfile`：

```bash
brew services start caddy
```

### 4.4 轻量方案

```bash
cd /path/to/dist && python3 -m http.server 4173
# 或
node /path/to/serve.mjs 4173
```

---

## 5. 部署后验证

1. 浏览器访问部署地址，应弹出**免责声明弹窗**（首次访问）
2. 同意后进入终端界面，日志区顶部显示协议全文
3. 尝试加密一个文件并解密，确认加解密正常（报错时打开 F12 → 控制台查看错误信息）
4. HTTPS/localhost 下可确认 PWA：地址栏出现安装图标（Chrome/Edge），或「添加到主屏幕」（移动端）

## 6. 更新与维护

1. 从 Release 页下载新版 `dist-*.zip`，解压后**覆盖** `dist/` 全部文件
2. 静态资源文件名带内容哈希，浏览器自动加载新版本；Service Worker 缓存策略为 cache-first，首次访问新版建议 **Ctrl+F5 硬刷新**，之后自动保持新版本
3. 服务器配置（Nginx/Caddy）无需改动

## 7. 常见问题

| 问题 | 原因与解决 |
| --- | --- |
| 打开后白屏/加载失败 | 控制台报错多为 MIME 错误：确认 `.wasm` 返回 `application/wasm`（见上方各服务器 types 配置） |
| PWA 安装按钮不出现 | 通过 HTTP 而非 HTTPS 访问（localhost 除外），或 Service Worker 被拦截；请启用 HTTPS |
| 启动时提示浏览器能力缺失 | 浏览器过旧，按弹窗内指南升级 Chrome/Firefox/Edge |
| 局域网内其他设备无法访问 | `start.bat` / `serve.mjs` 默认仅绑定 127.0.0.1；局域网/公网部署请用 Nginx/Caddy 并设置 `listen` 为 `0.0.0.0:80` |
| 端口被占用 | `start.bat` 或 `serve.mjs` 后接其他端口号即可（如 `start.bat 8080`） |
