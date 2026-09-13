/**
 * Post-build: rewrite @shared/* → relative paths in compiled output.
 *
 * TypeScript's `paths` mapping (`@shared/*` → `../shared/src/*`) is
 * compile-time only.  The emitted JavaScript keeps the original bare
 * specifier (`@shared/seller.js`), which plain `node` cannot resolve.
 *
 * This script walks every .js file in backend/dist/ and replaces each
 * `@shared/` reference with the correct relative path to the compiled
 * shared code at dist/shared/src/.
 *
 * It runs automatically after `tsc` via the `build` script in
 * backend/package.json.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../dist');
const sharedSrc = join(distDir, 'shared', 'src');

/** Recursively collect every .js file under `dir`. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let count = 0;
for (const file of walk(distDir)) {
  const code = readFileSync(file, 'utf8');
  if (!code.includes("'@shared/") && !code.includes('"@shared/')) continue;

  // Compute the relative path from this file's directory to dist/shared/src/
  let rel = relative(dirname(file), sharedSrc).replaceAll('\\', '/');
  if (!rel.startsWith('.')) rel = './' + rel;

  const updated = code.replaceAll('@shared/', rel + '/');
  writeFileSync(file, updated, 'utf8');
  count++;
}

if (count > 0) {
  console.log(`[fix-shared-imports] rewrote @shared/ paths in ${count} file(s)`);
}
