import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const navigation = readJson('config/doc-navigation.json');
const redirects = readJson('config/doc-redirects.json');
const expected = [
  ...navigation.gettingStarted,
  ...navigation.guides.flatMap((group) => group.items),
];
const errors = [];
if (new Set(expected).size !== expected.length) errors.push('Duplicate document in navigation');

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.mdx?$/.test(file) ? [file] : [];
  });
}

for (const locale of ['docs', 'i18n/en/docusaurus-plugin-content-docs/current']) {
  const base = path.join(root, locale);
  const files = walk(base);
  const ids = new Set(files.map((file) =>
    path.relative(base, file).replaceAll('\\', '/').replace(/\.mdx?$/, ''),
  ));
  for (const id of expected) {
    if (!ids.has(id)) errors.push(`${locale}: navigation target missing: ${id}`);
  }
  for (const id of ids) {
    if (/^(getting-started|guides)\//.test(id) && !expected.includes(id)) {
      errors.push(`${locale}: article missing from navigation: ${id}`);
    }
  }
  for (const [from, to] of Object.entries(redirects)) {
    if (ids.has(from) || ids.has(`${from}/index`)) errors.push(`${locale}: redirect shadows article: ${from}`);
    if (!ids.has(to) && !ids.has(`${to}/index`)) errors.push(`${locale}: redirect target missing: ${to}`);
    if (redirects[to]) errors.push(`Redirect chain: ${from} -> ${to}`);
  }
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(base, file).replaceAll('\\', '/');
    if (expected.includes(rel.replace(/\.mdx?$/, '')) && /^sidebar_position:/m.test(content)) {
      errors.push(`${locale}/${rel}: order belongs in config/doc-navigation.json`);
    }
    if (/^## (学习路径|Learning path)\s*$/m.test(content)) {
      errors.push(`${locale}/${rel}: use sidebar pagination instead of handwritten prev/next`);
    }
    for (const from of Object.keys(redirects)) {
      if (content.includes(`](/docs/${from}/`)) errors.push(`${locale}/${rel}: links to legacy route ${from}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation navigation and ${Object.keys(redirects).length} redirects are consistent in both locales.`);
}
