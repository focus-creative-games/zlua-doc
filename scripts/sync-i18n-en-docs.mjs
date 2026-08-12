#!/usr/bin/env node
/**
 * Sync docs/ into i18n/en/docusaurus-plugin-content-docs/current/.
 * Default: copy only missing files. --force overwrites all.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcRoot = path.join(root, 'docs');
const destRoot = path.join(
  root,
  'i18n',
  'en',
  'docusaurus-plugin-content-docs',
  'current',
);
const force = process.argv.includes('--force');

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && (ent.name.endsWith('.md') || ent.name.endsWith('.mdx'))) yield p;
  }
}

fs.mkdirSync(destRoot, {recursive: true});
let copied = 0;
let skipped = 0;
for (const src of walk(srcRoot)) {
  const rel = path.relative(srcRoot, src);
  const dest = path.join(destRoot, rel);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  if (!force && fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  fs.copyFileSync(src, dest);
  copied++;
  console.log(force ? 'overwrite' : 'copy', rel.replace(/\\/g, '/'));
}
console.log(`done: copied=${copied} skipped=${skipped} force=${force}`);
