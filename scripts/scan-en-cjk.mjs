import fs from 'node:fs';
import path from 'node:path';

const root = 'i18n/en/docusaurus-plugin-content-docs/current';

function stripCode(s) {
  return s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
}

function walk(d) {
  for (const ent of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.md')) {
      const raw = fs.readFileSync(p, 'utf8');
      const c = stripCode(raw);
      const m = c.match(/[\u4e00-\u9fff]+/g);
      if (m) {
        console.log('---', path.relative(root, p));
        console.log([...new Set(m)].slice(0, 25).join(' | '));
      }
    }
  }
}

walk(root);
