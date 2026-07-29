#!/usr/bin/env node
/**
 * 为 docs/guides 主线 md 注入「学习路径」上一篇/下一篇（幂等）。
 * 用法: node scripts/inject-guide-nav.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guidesDir = path.join(__dirname, '..', 'docs', 'guides');

/** 主线顺序（不含 migration 子目录与附录） */
const chain = [
  {slug: '/docs/getting-started/quick-start/', title: '快速开始'},
  {slug: '/docs/guides/install/', title: '安装与 Lua 版本'},
  {slug: '/docs/guides/hello-interop/', title: '初始化与最小互调'},
  {slug: '/docs/guides/build/', title: '构建流程'},
  {slug: '/docs/guides/debugger/', title: 'EmmyLua 调试器'},
  {slug: '/docs/guides/lua-calling-csharp/', title: 'Lua 调用 C#'},
  {slug: '/docs/guides/csharp-calling-lua/', title: 'C# 调用 Lua'},
  {slug: '/docs/guides/value-types/', title: '值类型与基础 0GC'},
  {slug: '/docs/guides/functions/', title: 'Function 与 Delegate'},
  {slug: '/docs/guides/arrays/', title: '数组'},
  {slug: '/docs/guides/generics/', title: '泛型'},
  {slug: '/docs/guides/ref-out-in/', title: 'ref / in / out'},
  {slug: '/docs/guides/lua-marshal-as/', title: 'LuaMarshalAs'},
  {slug: '/docs/guides/zero-gc-marshal/', title: '0GC Marshal'},
  {slug: '/docs/guides/overloads/', title: '方法重载'},
  {slug: '/docs/guides/lua-alias/', title: 'LuaAlias'},
  {slug: '/docs/guides/zlua-lib/', title: '常用 zlua 库'},
  {slug: '/docs/guides/migration/', title: '迁移指南'},
  {slug: '/docs/guides/troubleshooting/', title: '排错指南'},
  {slug: '/docs/guides/editor-vs-player/', title: 'Editor 与 Player'},
];

function buildNavBlock(prev, next) {
  const prevCell = prev ? `[${prev.title}](${prev.slug})` : '—';
  const nextCell = next ? `[${next.title}](${next.slug})` : '—';
  return `## 学习路径

| | |
|---|---|
| **上一篇** | ${prevCell} |
| **下一篇** | ${nextCell} |

`;
}

const mainlineFiles = new Set(
  chain
    .filter((item) => item.slug.startsWith('/docs/guides/') && !item.slug.includes('migration'))
    .map((item) => item.slug.replace(/^\/docs\/guides\//, '').replace(/\/$/, '') + '.md'),
);

for (const file of fs.readdirSync(guidesDir)) {
  if (!file.endsWith('.md')) continue;
  if (!mainlineFiles.has(file)) continue;

  const name = file.replace(/\.md$/, '');
  const idx = chain.findIndex((item) => item.slug === `/docs/guides/${name}/`);
  if (idx === -1) continue;

  const filePath = path.join(guidesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/\r\n/g, '\n');
  content = content.replace(/\n## 学习路径\n[\s\S]*?(?=\n## |$)/g, '\n');

  const navBlock = buildNavBlock(chain[idx - 1], chain[idx + 1]);
  const marker = '\n## 相关文档\n';
  if (content.includes(marker)) {
    content = content.replace(marker, `\n${navBlock}${marker.trimStart()}`);
  } else {
    content = content.trimEnd() + '\n\n' + navBlock;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('updated', file);
}

console.log('done');
