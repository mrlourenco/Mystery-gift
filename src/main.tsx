import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NoAuthService } from './auth';
import { config, isSupabaseConfigured } from './config/env';
import { InMemoryEventRepository, LocalEventRepository, type EventRepository } from './data';
import { LocalLinkService } from './links';
import { App, type Services } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

/** Ponto único de composição: Supabase se estiver configurado, senão tudo local. */
async function createServices(): Promise<Services> {
  if (isSupabaseConfigured(config)) {
    // Import dinâmico: o supabase-js só é descarregado quando é usado.
    const { createSupabaseServices } = await import('./supabase');
    return createSupabaseServices(config.supabaseUrl!, config.supabaseAnonKey!);
  }
  const repository: EventRepository =
    typeof indexedDB !== 'undefined' ? new LocalEventRepository() : new InMemoryEventRepository();
  return {
    repository,
    auth: new NoAuthService(),
    links: new LocalLinkService(repository),
    mailer: null, // sem servidor: envio por mailto:
  };
}

void createServices().then((services) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  ),
);
