# ZLua Docs

[ZLua Docs](https://doc.zlua.cn) 是 [ZLua](https://github.com/focus-creative-games/zlua) 的官方文档站点源码，基于 [Docusaurus](https://docusaurus.io/) 构建。

## 本地开发

```bash
npm install
npm start
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

## 构建

```bash
npm run build
npm run serve
```

## 部署（GitHub Pages）

推送到 `main` 分支后，[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) 会自动构建并部署到 **https://doc.zlua.cn**。

### 首次启用

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
2. DNS 为 `doc.zlua.cn` 配置 CNAME 指向 `<org>.github.io`（或按 GitHub Pages 自定义域名说明配置）
3. 仓库 Settings → Pages 中填写 Custom domain：`doc.zlua.cn` 并启用 HTTPS

`static/CNAME` 会在构建时写入站点根目录，供 GitHub Pages 识别自定义域名。

## 文档结构

- `docs/getting-started/` — 入门
- `docs/guides/` — 使用指南
- `docs/concepts/` — 核心概念
- `docs/reference/` — API 参考
- `docs/spec/` — 规范文档（权威语义）
- `docs/architecture/` — 架构与性能
- `docs/community/` — 社区与贡献

## 许可证

MIT
