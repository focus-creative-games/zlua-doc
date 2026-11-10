import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'docs');
const translated = path.join(root, 'i18n/en/docusaurus-plugin-content-docs/current');
const ledgerFile = path.join(root, 'i18n/en/translation-status.json');
const args = process.argv.slice(2);
const accept = args[0] === '--accept';
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : {
  version: 1,
  note: 'Baseline records detect future drift; they do not certify translation accuracy.',
  pages: {},
};

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.mdx?$/.test(file) ? [file] : [];
  });
}

function hash(file) {
  const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(content).digest('hex');
}

const pages = walk(source).map((file) => path.relative(source, file).replaceAll('\\', '/'));
if (accept) {
  const selected = args.slice(1);
  if (!selected.length || selected.some((rel) => !pages.includes(rel))) {
    throw new Error('Specify existing docs-relative files: npm run i18n:accept -- getting-started/installation.md');
  }
  for (const rel of selected) {
    if (!fs.existsSync(path.join(translated, rel))) throw new Error(`Translation missing: ${rel}`);
    ledger.pages[rel] = {
      sourceHash: hash(path.join(source, rel)),
      translationHash: hash(path.join(translated, rel)),
      status: 'reviewed',
    };
  }
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
  console.log(`Recorded bilingual review for ${selected.length} files.`);
} else if (args.length) {
  throw new Error('Supported arguments: --accept <docs-relative files>. Translations are never overwritten.');
}

const pending = [];
let baseline = 0;
for (const rel of pages) {
  const file = path.join(translated, rel);
  const record = ledger.pages[rel];
  if (!fs.existsSync(file)) pending.push(`missing translation: ${rel}`);
  else if (!record) pending.push(`untracked translation: ${rel}`);
  else if (record.sourceHash !== hash(path.join(source, rel))) pending.push(`source changed: ${rel}`);
  else if (record.translationHash !== hash(file)) pending.push(`translation changed; review required: ${rel}`);
  if (record?.status === 'baseline') baseline++;
}
for (const file of walk(translated)) {
  const rel = path.relative(translated, file).replaceAll('\\', '/');
  if (!pages.includes(rel)) pending.push(`translation without source: ${rel}`);
}
for (const rel of Object.keys(ledger.pages)) {
  if (!pages.includes(rel)) pending.push(`removed source still in ledger: ${rel}`);
}
if (pending.length) {
  console.error(pending.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Translation hashes match for ${pages.length} pages (${baseline} inherited baselines, not a full translation audit).`);
}
