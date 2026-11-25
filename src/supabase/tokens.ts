import { TOKEN_ALPHABET, TOKEN_LENGTH } from '../../supabase/functions/_shared/tokens.ts';

// Fonte única, partilhada com a Edge Function.
export {
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  generateToken,
  formatToken,
} from '../../supabase/functions/_shared/tokens.ts';

const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

/** Aceita minúsculas, hífenes, espaços e confusões comuns (O→0, I/L→1). */
export function normalizeToken(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return TOKEN_RE.test(s) ? s : null;
}
