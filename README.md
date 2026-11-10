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

构建只读取源文件，不会向 Markdown 注入导航。入门和指南顺序集中维护在 `config/doc-navigation.json`，上一篇 / 下一篇由 Docusaurus 侧栏自动生成。旧地址集中维护在 `config/doc-redirects.json`，通过本地插件生成保留语言的静态跳转页。

提交前执行：

```bash
npm run typecheck
npm run check:docs
npm run check:i18n
npm run build
```

PR 与部署工作流均执行上述检查。新增入门 / 指南页时必须同时登记导航；移除或合并已发布页面时登记旧地址，并将站内链接指向新正文。

## 内容唯一来源

- 安装步骤：`docs/getting-started/installation.md`；完整可复制示例：`quick-start.mdx`；Player 发布步骤：`build.md`。
- 支持版本、平台与分支限制：`docs/getting-started/compatibility.md`。首页和介绍链接该页，不重复维护版本清单。
- 实测性能数字与报告环境：`docs/compare/PERFORMANCE.md`。GC 与体积页明确区分实测、分析和待测项目。
- 热更 XML 的宿主契约：`docs/spec/01-HOST-API.md`；API 用法索引：`docs/reference/csharp/interop-metadata.md`。

## 英文更新追踪

`i18n/en/translation-status.json` 记录中文源文和英文译文的 SHA-256（忽略 CRLF / LF 差异）。源文或译文变化、新增 / 删除页面都会让 `npm run check:i18n` 报错，且不会覆盖英文文件。`npm run sync-i18n-en` 保留为只读状态检查别名，旧 `--force` 覆盖行为已移除。

修改中文后，同步编辑对应英文，人工核对后逐文件确认：

```bash
npm run i18n:accept -- getting-started/installation.md getting-started/quick-start.mdx
```

`reviewed` 表示确认过当前中英文；`baseline` 仅记录接入追踪时的现状，不代表完成全文翻译审校。不要为了通过 CI 批量确认未核对的译文。删除页面时同时移除追踪条目；迁移路径时为新路径登记对应译文。

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
- `docs/guides/` — 按任务分组的使用指南（含迁移）
- `docs/concepts/` — 核心概念与术语
- `docs/compare/` — 选型对比（xLua / toLua / SLua）
- `docs/reference/` — API 参考
- `docs/spec/` — **规范文档（权威语义）**
- `docs/impl/` — 架构与实现对照（架构侧栏）
- `docs/community/` — 社区、贡献与测试

## 许可证

MIT
