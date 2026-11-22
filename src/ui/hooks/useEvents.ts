import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventId, GiftEvent } from '../../domain';
import { useEventRepository } from '../../data';

type Load<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

export function useEventList() {
  const repo = useEventRepository();
  const [state, setState] = useState<Load<GiftEvent[]>>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await repo.list() });
    } catch (e) {
      setState({ status: 'error', error: e as Error });
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (id: EventId) => {
      await repo.delete(id);
      await reload();
    },
    [repo, reload],
  );

  return { state, reload, remove };
}

export function useEvent(id: EventId | undefined) {
  const repo = useEventRepository();
  const [state, setState] = useState<Load<GiftEvent | null>>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ status: 'ready', data: null });
      return;
    }
    setState({ status: 'loading' });
    repo.get(id).then(
      (data) => alive && setState({ status: 'ready', data }),
      (error: Error) => alive && setState({ status: 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [repo, id]);

  // Alterações em fila, sempre aplicadas sobre a versão mais recente (evita perder
  // alterações quando o utilizador clica mais depressa do que o IndexedDB grava).
  const latest = useRef<GiftEvent | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  if (state.status === 'ready' && state.data && latest.current?.id !== state.data.id) {
    latest.current = state.data;
  }

  /** Aplica `fn` à versão mais recente, guarda e atualiza o estado. */
  const update = useCallback(
    (fn: (current: GiftEvent) => GiftEvent): Promise<GiftEvent> => {
      const run = queue.current.then(async () => {
        if (!latest.current) throw new Error('Evento não carregado');
        const next = fn(latest.current);
        await repo.save(next);
        latest.current = next;
        setState({ status: 'ready', data: next });
        return next;
      });
      queue.current = run.catch(() => {});
      return run;
    },
    [repo],
  );

  const save = useCallback((event: GiftEvent) => update(() => event), [update]);

  return { state, save, update };
}
