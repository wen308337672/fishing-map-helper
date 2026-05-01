# 天地图瓦片代理 — Vercel 部署指南

## 方案说明

用 Vercel Edge Function 做代理，绕过天地图 Referer 白名单限制：
- 小程序 → Vercel 代理（自己的域名，无 Referer 限制）
- Vercel → 天地图（带正确 Referer + KEY）

**费用**：完全免费（Vercel Hobby 计划 100GB/月，小程序够用）

---

## 部署步骤

### 1. GitHub 新建仓库

在 github.com 新建一个空仓库，例如 `fishing-tile-proxy`，记下仓库地址：
```
https://github.com/你的用户名/fishing-tile-proxy
```

### 2. 本地初始化 Git

```bash
cd C:\Users\Administrator\WorkBuddy\20260319135453
git init
git add api/ vercel.json
git commit -m "Add Tianditu tile proxy"
```

### 3. 推送到 GitHub

```bash
git remote add origin https://github.com/你的用户名/fishing-tile-proxy.git
git branch -M main
git push -u origin main
```

### 4. Vercel 关联 GitHub

1. 访问 https://vercel.com 并登录（可用 GitHub 账号）
2. 点击 "Add New Project" → 选择刚推送的仓库
3. Framework Preset 选 "Other"
4. 点击 Deploy，静等 30 秒完成

部署成功后获得 URL，例如：
```
https://fishing-tile-proxy.vercel.app
```

### 5. 验证代理

浏览器访问测试：
```
https://fishing-tile-proxy.vercel.app/api/tile?x=5433&y=2567&z=13&type=img
```

应该返回一张卫星地图瓦片图片。

### 6. 修改小程序瓦片 URL

在 `utils/tiandituTile.js` 中，找到天地图相关配置，将瓦片 URL 改为：

```javascript
// 代理模式（部署 Vercel 后启用）
const PROXY_BASE = 'https://fishing-tile-proxy.vercel.app/api/tile';

img: function(col, row, zoom) {
  return `${PROXY_BASE}?x=${col}&y=${row}&z=${zoom}&type=img`;
}
label: function(col, row, zoom) {
  return `${PROXY_BASE}?x=${col}&y=${row}&z=${zoom}&type=cia`;
}
```

### 7. 微信公众平台添加白名单

将 `fishing-tile-proxy.vercel.app` 添加到：
- **request 合法的域名**（瓦片请求）
- **downloadFile 合法的域名**（瓦片下载）

---

## 目录结构

```
fishing-tile-proxy/
├── api/
│   └── tile-proxy.js   ← Vercel Edge Function（代理逻辑）
├── vercel.json         ← Vercel 配置文件
└── README.md
```

---

## 多图层支持

| type 参数 | 天地图图层 | 说明 |
|-----------|-----------|------|
| img | img_w | 卫星影像 |
| cia | cia_w | 卫星图注记叠加 |
| vec | vec_w | 矢量电子地图 |
| cva | cva_w | 矢量注记叠加 |

调用示例：
- 卫星影像：`/api/tile?x=5433&y=2567&z=13&type=img`
- 矢量底图：`/api/tile?x=5433&y=2567&z=13&type=vec`

---

## 调试

本地预览（需安装 Vercel CLI）：
```bash
npx vercel dev
```

查看 Vercel 函数日志：
- 登录 vercel.com → 你的项目 → Deployment → Logs