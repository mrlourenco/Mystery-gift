export interface ShareInput {
  title: string;
  text: string;
  url: string;
}

export type ShareOutcome = 'shared' | 'cancelled' | 'fallback';

export function whatsappUrl({ text, url }: ShareInput): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
}

/** Web Share API; se não existir (ou falhar), abre o WhatsApp (wa.me). */
export async function shareLink(
  input: ShareInput,
  nav: Pick<Navigator, 'share' | 'canShare'> | undefined = typeof navigator !== 'undefined'
    ? navigator
    : undefined,
  open: (url: string) => void = (u) => window.open(u, '_blank', 'noopener'),
): Promise<ShareOutcome> {
  if (nav?.share && (!nav.canShare || nav.canShare(input))) {
    try {
      await nav.share(input);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  open(whatsappUrl(input));
  return 'fallback';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para contextos sem Clipboard API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy') ?? false;
    ta.remove();
    return ok;
  }
}
