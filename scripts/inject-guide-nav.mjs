#!/usr/bin/env node
/**
 * 为 docs/guides/*.md 注入「学习路径」上一篇/下一篇（幂等）。
 * 用法: node scripts/inject-guide-nav.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guidesDir = path.join(__dirname, '..', 'docs', 'guides');

const chain = [
  {slug: '/docs/getting-started/quick-start/', title: '快速开始'},
  {slug: '/docs/guides/csharp-to-lua/', title: 'C# 调用 Lua'},
  {slug: '/docs/guides/lua-to-csharp-basics/', title: 'Lua 访问 C# 基础'},
  {slug: '/docs/guides/fields-and-properties/', title: '字段与属性'},
  {slug: '/docs/guides/methods-and-overloads/', title: '方法重载'},
  {slug: '/docs/guides/callbacks-and-delegates/', title: '回调与 Delegate'},
  {slug: '/docs/guides/generics-and-arrays/', title: '泛型与数组'},
  {slug: '/docs/guides/marshal-ref-out-in/', title: 'ref / out / in'},
  {slug: '/docs/guides/lua-module-loading/', title: 'Lua 模块加载'},
  {slug: '/docs/guides/events/', title: 'Event'},
  {slug: '/docs/guides/enums-and-structs/', title: 'enum 与 struct'},
  {slug: '/docs/guides/troubleshooting/', title: '排错指南'},
  {slug: '/docs/guides/editor-vs-player/', title: 'Editor 与 Player'},
  {slug: '/docs/guides/best-practices/', title: '最佳实践'},
  {slug: '/docs/concepts/design-overview/', title: '设计概览'},
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

for (const file of fs.readdirSync(guidesDir)) {
  if (!file.endsWith('.md')) continue;
  const name = file.replace(/\.md$/, '');
  const idx = chain.findIndex(
    (item, i) =>
      i > 0 &&
      i < chain.length - 1 &&
      item.slug === `/docs/guides/${name}/`,
  );
  if (idx === -1) continue;

  const filePath = path.join(guidesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/\r\n/g, '\n');
  content = content.replace(/\n## 学习路径\n[\s\S]*?(?=\n## )/g, '\n');

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
