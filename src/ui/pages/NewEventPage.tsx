import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../../domain';
import { useEventRepository } from '../../data';
import { useAuth } from '../../auth';
import { Layout } from '../components/Layout';
import { EventDetailsForm } from './EventDetailsForm';

export function NewEventPage() {
  const repo = useEventRepository();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  return (
    <Layout title="Novo evento" back={{ to: '/', label: 'Eventos' }}>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <EventDetailsForm
        submitLabel="Criar evento"
        onSubmit={async (details) => {
          const ownerId = user?.kind === 'authenticated' ? user.id : null;
          const event = createEvent(details, { ownerId });
          try {
            await repo.save(event);
          } catch {
            setError('Não foi possível criar o evento. Verifica a ligação à internet.');
            return;
          }
          navigate(`/eventos/${event.id}`, { replace: true });
        }}
      />
    </Layout>
  );
}
