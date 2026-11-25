/** Igual a src/supabase/tokens.ts (a Edge Function não importa código de src/). */
export const TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const TOKEN_LENGTH = 12;

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  let out = '';
  for (const b of bytes) out += TOKEN_ALPHABET[b % 32];
  return out;
}

export const formatToken = (t: string) => t.match(/.{1,4}/g)?.join('-') ?? t;
