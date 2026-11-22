export type IdGenerator = () => string;

export const randomId: IdGenerator = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

/** ID curto (8 caracteres base36) para o sorteio — vai dentro do link. */
export const shortId: IdGenerator = () => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36))
    .join('')
    .padEnd(8, '0')
    .slice(0, 8);
};
