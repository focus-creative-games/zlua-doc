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

`prebuild` 会运行 `inject-guide-nav`，为指南页注入上一篇/下一篇导航。

## 权威与写作约定

| 层级 | 路径 | 说明 |
|------|------|------|
| **规范（唯一语义标准）** | `docs/spec/` | Lua 可见行为以本目录为准 |
| 实现对照 | `docs/impl/` | Mono / Il2Cpp 实现说明，不覆盖 spec |
| 选型对比 | `docs/compare/` | 非行为契约 |
| 用户指南 / API | `docs/guides/`、`docs/reference/` 等 | 不得与 `docs/spec` 冲突 |

冲突裁决：**`docs/spec` → Il2Cpp 源码 → `docs/impl`**。

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
- `docs/concepts/` — 核心概念与术语
- `docs/compare/` — 选型对比（xLua / toLua / SLua）
- `docs/reference/` — API 参考
- `docs/spec/` — **规范文档（权威语义）**
- `docs/impl/` — 架构与实现对照（架构侧栏）
- `docs/community/` — 社区、迁移、贡献与测试

## 许可证

MIT
