import type { Services } from '../ui/App';
import { CachingEventRepository, LocalEventRepository } from '../data';
import { createSupabase } from './client';
import { SupabaseAuthService } from './SupabaseAuthService';
import { SupabaseEventRepository } from './SupabaseEventRepository';
import { SupabaseLinkService } from './SupabaseLinkService';
import { SupabaseDrawMailer } from './SupabaseDrawMailer';

/** Composição dos serviços quando o Supabase está configurado. */
export function createSupabaseServices(url: string, anonKey: string): Services {
  const supabase = createSupabase(url, anonKey);
  const auth = new SupabaseAuthService(supabase);
  const ensure = () => auth.ensureSignedIn();
  const remote = new SupabaseEventRepository(supabase, ensure);
  // Base de dados local separada da Fase 1, para não misturar eventos só locais com a cache.
  const repository = new CachingEventRepository(
    remote,
    new LocalEventRepository('amigo-secreto-cache'),
  );
  return {
    auth,
    repository,
    links: new SupabaseLinkService(supabase, ensure),
    mailer: new SupabaseDrawMailer(supabase, ensure),
  };
}
