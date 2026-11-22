import { useCallback, useEffect, useRef, useState } from 'react';

/** Mensagem temporária anunciada a leitores de ecrã (aria-live). */
export function useStatus(timeout = 3000) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(
    (m: string) => {
      setMessage(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(''), timeout);
    },
    [timeout],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className={`toast ${message ? 'toast-visible' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
  return [node, show] as const;
}
