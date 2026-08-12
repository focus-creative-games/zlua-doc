#!/usr/bin/env node
/**
 * Collapse runs of blank lines in docs markdown to a single blank line,
 * and ensure each file ends with one trailing newline.
 * Usage: node scripts/collapse-md-blank-lines.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, '..', 'docs');

function* walkMd(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkMd(p);
    else if (ent.isFile() && ent.name.endsWith('.md')) yield p;
  }
}

function collapse(content) {
  let s = content.replace(/\r\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n*$/, '\n');
  return s;
}

let changed = 0;
for (const file of walkMd(docsDir)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = collapse(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
    console.log('cleaned', path.relative(path.join(__dirname, '..'), file));
  }
}
console.log(`done, ${changed} file(s) changed`);
