#!/usr/bin/env node
/**
 * Inject learning-path prev/next into guide md files (idempotent).
 * Usage: node scripts/inject-guide-nav.mjs
 * Touches docs/guides and i18n/en/.../guides when present.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const chainZh = [
  {slug: '/docs/getting-started/quick-start/', title: '快速开始'},
  {slug: '/docs/guides/install/', title: '安装与 Lua 版本'},
  {slug: '/docs/guides/hybridclr/', title: '同时使用 HybridCLR + ZLua'},
  {slug: '/docs/guides/hello-interop/', title: '初始化与最小互调'},
  {slug: '/docs/guides/build/', title: '构建流程'},
  {slug: '/docs/guides/debugger/', title: 'EmmyLua 调试器'},
  {slug: '/docs/guides/lua-calling-csharp/', title: 'Lua 调用 C#'},
  {slug: '/docs/guides/csharp-calling-lua/', title: 'C# 调用 Lua'},
  {slug: '/docs/guides/value-types/', title: '值类型'},
  {slug: '/docs/guides/functions/', title: 'Function 与 Delegate'},
  {slug: '/docs/guides/arrays/', title: '数组'},
  {slug: '/docs/guides/generics/', title: '泛型'},
  {slug: '/docs/guides/ref-out-in/', title: 'ref / in / out'},
  {slug: '/docs/guides/lua-marshal-as/', title: 'LuaMarshalAs'},
  {slug: '/docs/guides/zero-gc-marshal/', title: '0GC Marshal'},
  {slug: '/docs/guides/overloads/', title: '方法重载'},
  {slug: '/docs/guides/lua-alias/', title: 'LuaAlias'},
  {slug: '/docs/guides/extension-methods/', title: 'Extension 方法'},
  {slug: '/docs/guides/zlua-lib/', title: '常用 zlua 库'},
  {slug: '/docs/guides/native-modules/', title: '第三方原生插件'},
  {slug: '/docs/guides/migration/', title: '迁移指南'},
  {slug: '/docs/guides/troubleshooting/', title: '排错指南'},
  {slug: '/docs/guides/editor-vs-player/', title: 'Editor 与 Player'},
];

const chainEn = [
  {slug: '/docs/getting-started/quick-start/', title: 'Quick start'},
  {slug: '/docs/guides/install/', title: 'Install & Lua version'},
  {slug: '/docs/guides/hybridclr/', title: 'Using HybridCLR with ZLua'},
  {slug: '/docs/guides/hello-interop/', title: 'Init & minimal interop'},
  {slug: '/docs/guides/build/', title: 'Build pipeline'},
  {slug: '/docs/guides/debugger/', title: 'EmmyLua debugger'},
  {slug: '/docs/guides/lua-calling-csharp/', title: 'Lua calling C#'},
  {slug: '/docs/guides/csharp-calling-lua/', title: 'C# calling Lua'},
  {slug: '/docs/guides/value-types/', title: 'Value types'},
  {slug: '/docs/guides/functions/', title: 'Function & Delegate'},
  {slug: '/docs/guides/arrays/', title: 'Arrays'},
  {slug: '/docs/guides/generics/', title: 'Generics'},
  {slug: '/docs/guides/ref-out-in/', title: 'ref / in / out'},
  {slug: '/docs/guides/lua-marshal-as/', title: 'LuaMarshalAs'},
  {slug: '/docs/guides/zero-gc-marshal/', title: '0GC Marshal'},
  {slug: '/docs/guides/overloads/', title: 'Method overloads'},
  {slug: '/docs/guides/lua-alias/', title: 'LuaAlias'},
  {slug: '/docs/guides/extension-methods/', title: 'Extension methods'},
  {slug: '/docs/guides/zlua-lib/', title: 'Common zlua APIs'},
  {slug: '/docs/guides/native-modules/', title: 'Third-party native modules'},
  {slug: '/docs/guides/migration/', title: 'Migration'},
  {slug: '/docs/guides/troubleshooting/', title: 'Troubleshooting'},
  {slug: '/docs/guides/editor-vs-player/', title: 'Editor vs Player'},
];

function buildNavBlock(prev, next, labels) {
  const prevCell = prev ? `[${prev.title}](${prev.slug})` : '—';
  const nextCell = next ? `[${next.title}](${next.slug})` : '—';
  return `## ${labels.heading}

| | |
|---|---|
| **${labels.prev}** | ${prevCell} |
| **${labels.next}** | ${nextCell} |

`;
}

function injectLocale(guidesDir, chain, labels) {
  if (!fs.existsSync(guidesDir)) {
    console.log('skip (missing)', guidesDir);
    return;
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
    content = content.replace(/\n## (学习路径|Learning path)\n[\s\S]*?(?=\n## |$)/g, '\n');
    content = content.replace(/\n{3,}/g, '\n\n');

    const navBlock = buildNavBlock(chain[idx - 1], chain[idx + 1], labels);
    const markers = ['\n## 相关文档\n', '\n## Related\n'];
    let inserted = false;
    for (const marker of markers) {
      if (content.includes(marker)) {
        content = content.replace(marker, `\n${navBlock}${marker.trimStart()}`);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      content = content.trimEnd() + '\n\n' + navBlock;
    }
    content = content.replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('updated', path.relative(root, filePath).replace(/\\/g, '/'));
  }
}

injectLocale(path.join(root, 'docs', 'guides'), chainZh, {
  heading: '学习路径',
  prev: '上一篇',
  next: '下一篇',
});

injectLocale(
  path.join(root, 'i18n', 'en', 'docusaurus-plugin-content-docs', 'current', 'guides'),
  chainEn,
  {heading: 'Learning path', prev: 'Previous', next: 'Next'},
);

console.log('done');
