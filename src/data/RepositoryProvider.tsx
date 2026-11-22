import { createContext, useContext, type ReactNode } from 'react';
import type { EventRepository } from './EventRepository';

const RepositoryContext = createContext<EventRepository | null>(null);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: EventRepository;
  children: ReactNode;
}) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEventRepository(): EventRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useEventRepository tem de estar dentro de <RepositoryProvider>');
  return repo;
}
