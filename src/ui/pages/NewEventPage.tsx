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
  return (
    <Layout title="Novo evento" back={{ to: '/', label: 'Eventos' }}>
      <EventDetailsForm
        submitLabel="Criar evento"
        onSubmit={async (details) => {
          const ownerId = user?.kind === 'authenticated' ? user.id : null;
          const event = createEvent(details, { ownerId });
          await repo.save(event);
          navigate(`/eventos/${event.id}`, { replace: true });
        }}
      />
    </Layout>
  );
}
