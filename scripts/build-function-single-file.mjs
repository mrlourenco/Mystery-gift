// Gera supabase/dashboard/send-draw-emails.ts: a Edge Function num só ficheiro,
// para colar no editor do painel do Supabase (sem CLI). Uso: npm run function:single
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../supabase/functions/', import.meta.url));
const out = fileURLToPath(new URL('../supabase/dashboard/send-draw-emails.ts', import.meta.url));

const strip = (src) =>
  src
    .replace(/^import .*;\n/gm, '')
    .replace(/^export \{[^}]*\} from .*;\n/gm, '')
    .replace(/^export (const|function|interface|type) /gm, '$1 ');

const shared = await Promise.all(
  ['_shared/drawEmail.ts', '_shared/tokens.ts'].map(async (f) => {
    const src = await readFile(root + f, 'utf8');
    return `// ───── ${f} ─────\n${strip(src)}`;
  }),
);
const main = await readFile(root + 'send-draw-emails/index.ts', 'utf8');
const imports = main.match(/^import .* from 'npm:.*;\n/gm).join('');
const body = main.replace(/^import .*;\n/gm, '');

await writeFile(
  out,
  `// GERADO por scripts/build-function-single-file.mjs — não editar à mão.
// Edge Function send-draw-emails num só ficheiro, para colar no painel do Supabase.
${imports}
${shared.join('\n')}
// ───── send-draw-emails/index.ts ─────
${body}`,
);
console.log('✓', out);
