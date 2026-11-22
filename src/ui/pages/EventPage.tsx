import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addParticipant,
  DomainError,
  DrawImpossibleError,
  formatDate,
  formatEuros,
  MIN_PARTICIPANTS,
  removeParticipant,
  renameParticipant,
  runDraw,
  updateDetails,
  type GiftEvent,
} from '../../domain';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Layout } from '../components/Layout';
import { useStatus } from '../components/StatusMessage';
import { useEvent } from '../hooks/useEvents';
import { EventDetailsForm } from './EventDetailsForm';
import { ParticipantsEditor } from './ParticipantsEditor';
import { NotFoundPage } from './NotFoundPage';

const SAVE_ERROR = 'Não foi possível guardar. Verifica a ligação à internet.';

const STALE_WARNING = (
  <p>
    Já existe um sorteio. Se continuares, o sorteio é apagado e{' '}
    <strong>os links já enviados deixam de corresponder ao resultado</strong>. Vais ter de fazer um
    novo sorteio e enviar os links outra vez.
  </p>
);

export function EventPage() {
  const { id } = useParams();
  const { state, update } = useEvent(id);
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const [status, showStatus] = useStatus();
  const [editingDetails, setEditingDetails] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  if (state.status === 'loading') return <Layout title="A carregar…">{null}</Layout>;
  if (state.status === 'error' || !state.data) return <NotFoundPage />;
  const event = state.data;

  const confirmIfDrawn = async () =>
    !event.draw ||
    confirm({
      title: 'Apagar o sorteio atual?',
      message: STALE_WARNING,
      confirmLabel: 'Continuar',
      danger: true,
    });

  const apply = async (fn: (current: GiftEvent) => GiftEvent): Promise<boolean> => {
    try {
      await update(fn);
      return true;
    } catch (e) {
      showStatus(e instanceof DomainError ? e.message : SAVE_ERROR);
      return false;
    }
  };

  const doDraw = async () => {
    setDrawError(null);
    try {
      await update((e) => runDraw(e));
      navigate(`/eventos/${event.id}/resultado`);
    } catch (e) {
      setDrawError(e instanceof DrawImpossibleError ? e.message : SAVE_ERROR);
    }
  };

  const missing = Math.max(0, MIN_PARTICIPANTS - event.participants.length);

  return (
    <Layout title={event.name} back={{ to: '/', label: 'Eventos' }}>
      <section className="section" aria-labelledby="detalhes-titulo">
        <h2 id="detalhes-titulo" className="visually-hidden">
          Detalhes
        </h2>
        {editingDetails ? (
          <>
            {event.draw && (
              <p className="alert alert-warning">
                Os links já enviados mostram o orçamento e a data antigos. Depois de guardar, volta
                a partilhá-los.
              </p>
            )}
            <EventDetailsForm
              initial={event}
              submitLabel="Guardar"
              onSubmit={async (d) => {
                await update((e) => updateDetails(e, d));
                setEditingDetails(false);
                showStatus('Detalhes guardados');
              }}
            />
            <Button variant="ghost" onClick={() => setEditingDetails(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <div className="summary">
            <dl>
              <div>
                <dt>Data</dt>
                <dd>{formatDate(event.exchangeDate)}</dd>
              </div>
              <div>
                <dt>Orçamento</dt>
                <dd>até {formatEuros(event.budgetCents)}</dd>
              </div>
            </dl>
            <Button onClick={() => setEditingDetails(true)}>Editar detalhes</Button>
          </div>
        )}
      </section>

      <ParticipantsEditor
        participants={event.participants}
        onAdd={async (name) => (await confirmIfDrawn()) && apply((e) => addParticipant(e, name))}
        onRename={async (pid, name) =>
          (await confirmIfDrawn()) && apply((e) => renameParticipant(e, pid, name))
        }
        onRemove={async (p) => {
          const ok = await confirm({
            title: `Remover ${p.name}?`,
            message: event.draw ? STALE_WARNING : <p>{p.name} vai ser removido da lista.</p>,
            confirmLabel: 'Remover',
            danger: true,
          });
          if (ok) await apply((e) => removeParticipant(e, p.id));
        }}
      />

      <section className="section" aria-labelledby="sorteio-titulo">
        <h2 id="sorteio-titulo">Sorteio</h2>
        {drawError && (
          <p className="alert alert-error" role="alert">
            {drawError}
          </p>
        )}
        {event.draw ? (
          <div className="actions">
            <Link className="btn btn-primary" to={`/eventos/${event.id}/resultado`}>
              Ver links
            </Link>
          </div>
        ) : (
          <>
            {missing > 0 && (
              <p className="muted" id="falta">
                {missing === 1 ? 'Falta 1 participante' : `Faltam ${missing} participantes`} para
                poder sortear (mínimo {MIN_PARTICIPANTS}).
              </p>
            )}
            <Button
              variant="primary"
              disabled={missing > 0}
              aria-describedby={missing > 0 ? 'falta' : undefined}
              onClick={doDraw}
            >
              Fazer sorteio
            </Button>
          </>
        )}
      </section>
      {dialog}
      {status}
    </Layout>
  );
}
