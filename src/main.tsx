import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NoAuthService } from './auth';
import { InMemoryEventRepository, LocalEventRepository, type EventRepository } from './data';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

// Ponto único de composição: na Fase 2 troca-se aqui por SupabaseEventRepository / SupabaseAuthService.
const repository: EventRepository =
  typeof indexedDB !== 'undefined' ? new LocalEventRepository() : new InMemoryEventRepository();
const auth = new NoAuthService();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} auth={auth} />
  </StrictMode>,
);
