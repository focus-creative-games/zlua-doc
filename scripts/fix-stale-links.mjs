/**
 * Fix stale internal links after Docs sync / IA refactor.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(md|mdx|tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const reps = [
  ['Il2Cpp · MVP', 'Il2Cpp · 已完成'],
  ['Mono · 全功能', 'Mono · 已完成'],
  ['Mono · 收尾中', 'Mono · 已完成'],
  ['重写收尾', '已完成'],
  ['](../concepts/comparison-with-xlua)', '](../compare/PERFORMANCE)'],
  ['](../concepts/xlua-comparison-report)', '](../compare/FEATURES)'],
  ['](./concepts/comparison-with-xlua)', '](./compare/)'],
  ['](./concepts/xlua-comparison-report)', '](./compare/FEATURES)'],
  ['](../architecture/il2cpp-architecture)', '](../impl/IL2CPP)'],
  ['](../architecture/optimization-report)', '](../compare/PERFORMANCE)'],
  ['](../architecture/call-path-overview)', '](../impl/IL2CPP)'],
  ['](../spec/design-spec)', '](../spec/00-OVERVIEW)'],
  ['](../spec/type-system-spec)', '](../spec/02-TYPE-SYSTEM)'],
  ['](../../spec/type-system-spec)', '](../../spec/02-TYPE-SYSTEM)'],
  ['](../spec/meta-table-spec)', '](../spec/metatable/)'],
  ['](../spec/lib-spec)', '](../spec/05-LIB)'],
  ['](../../spec/lib-spec)', '](../../spec/05-LIB)'],
  ['](../spec/method-overload-spec)', '](../spec/04-METHOD-OVERLOAD)'],
  ['](../../spec/method-overload-spec)', '](../../spec/04-METHOD-OVERLOAD)'],
  ['](../spec/vm-index-spec)', '](../spec/metatable/02-INDEX)'],
  ['](../spec/marshal/function)', '](../spec/marshal/09-FUNCTION)'],
  ['](../../spec/marshal/function)', '](../../spec/marshal/09-FUNCTION)'],
  ['](../spec/marshal/struct)', '](../spec/marshal/05-STRUCT)'],
  ['](../spec/marshal/class)', '](../spec/marshal/06-CLASS)'],
  ['](../community/migration-from-xlua)', '](../community/migration/from-xlua)'],
  ['project-status#il2cpp-mvp', 'project-status'],
  ['](./migration-from-xlua)', '](./migration/from-xlua)'],
  ['](../spec/)', '](../spec/00-OVERVIEW)'],
  ['](../../spec/)', '](../../spec/00-OVERVIEW)'],
  ['[README.md](../)', '[介绍](../intro)'],
  ['](../../)', '](../../intro)'],
];

let n = 0;
for (const dir of ['docs', 'src']) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  for (const f of walk(base)) {
    let t = fs.readFileSync(f, 'utf8');
    const o = t;
    for (const [a, b] of reps) t = t.split(a).join(b);
    if (t !== o) {
      fs.writeFileSync(f, t);
      n++;
      console.log('updated', path.relative(root, f));
    }
  }
}
console.log(`done, ${n} files`);
