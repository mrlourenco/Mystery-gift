import { fromPayload, isRevealPayload, toPayload, type RevealData } from './payload';

/**
 * ATENÇÃO: isto é OFUSCAÇÃO, não segurança. Impede que se leia o nome "de relance"
 * no URL, mas qualquer pessoa com conhecimentos técnicos consegue descodificar.
 *
 * JSON → UTF-8 → XOR com chave fixa → base64url
 */
const KEY = new TextEncoder().encode('amigo-secreto·v1');

function xor(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]! ^ KEY[i % KEY.length]! ^ (i & 0xff);
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('base64url inválido');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeReveal(data: RevealData): string {
  const json = JSON.stringify(toPayload(data));
  return bytesToBase64Url(xor(new TextEncoder().encode(json)));
}

export class InvalidCodeError extends Error {
  constructor() {
    super('Código inválido ou incompleto.');
    this.name = 'InvalidCodeError';
  }
}

export function decodeReveal(code: string): RevealData {
  try {
    const bytes = xor(base64UrlToBytes(code.trim()));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (!isRevealPayload(parsed)) throw new Error('payload');
    return fromPayload(parsed);
  } catch {
    throw new InvalidCodeError();
  }
}
