import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import type { AuthService } from '../auth';
import { AuthProvider } from '../auth';
import { RepositoryProvider, type EventRepository } from '../data';
import { LinkServiceProvider, type LinkService } from '../links';
import { EnterCodePage } from './pages/EnterCodePage';
import { EventListPage } from './pages/EventListPage';
import { EventPage } from './pages/EventPage';
import { NewEventPage } from './pages/NewEventPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResultPage } from './pages/ResultPage';
import { RevealPage } from './pages/RevealPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EventListPage />} />
      <Route path="/eventos/novo" element={<NewEventPage />} />
      <Route path="/eventos/:id" element={<EventPage />} />
      <Route path="/eventos/:id/resultado" element={<ResultPage />} />
      <Route path="/r/:code" element={<RevealPage />} />
      <Route path="/codigo" element={<EnterCodePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export interface Services {
  repository: EventRepository;
  auth: AuthService;
  links: LinkService;
}

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return (
    <AuthProvider service={services.auth}>
      <RepositoryProvider repository={services.repository}>
        <LinkServiceProvider service={services.links}>{children}</LinkServiceProvider>
      </RepositoryProvider>
    </AuthProvider>
  );
}

export function App({ services }: { services: Services }) {
  return (
    <ServicesProvider services={services}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ServicesProvider>
  );
}
