/** Alfabeto Crockford base32 (sem I, L, O, U): fácil de ler e de escrever à mão. */
export const TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const TOKEN_LENGTH = 12; // 60 bits
const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

export function generateToken(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(TOKEN_LENGTH);
  let out = '';
  // 256 é múltiplo de 32 → sem enviesamento.
  for (const b of bytes) out += TOKEN_ALPHABET[b % 32];
  return out;
}

function defaultRandom(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Aceita minúsculas, hífenes, espaços e confusões comuns (O→0, I/L→1). */
export function normalizeToken(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return TOKEN_RE.test(s) ? s : null;
}

export const formatToken = (t: string) => t.match(/.{1,4}/g)?.join('-') ?? t;
