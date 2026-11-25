import { Link } from 'react-router-dom';
import { formatBudget, formatDate } from '../../domain';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { useEventList } from '../hooks/useEvents';
import { useStatus } from '../components/StatusMessage';
import { ErrorDetails } from '../components/ErrorDetails';

export function EventListPage() {
  const { state, remove } = useEventList();
  const [dialog, confirm] = useConfirm();
  const [status, showStatus] = useStatus();

  return (
    <Layout title="Os teus eventos">
      <div className="actions">
        <Link className="btn btn-primary" to="/eventos/novo">
          Novo evento
        </Link>
        <Link className="btn btn-secondary" to="/codigo">
          Tenho um código
        </Link>
      </div>

      {state.status === 'loading' && <p aria-busy="true">A carregar…</p>}
      {state.status === 'error' && (
        <div className="alert alert-error" role="alert">
          <p className="alert-text">
            Não foi possível ler os eventos. Verifica a ligação à internet e recarrega a página.
          </p>
          <ErrorDetails error={state.error} />
        </div>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="empty">
          <p>Ainda não tens eventos.</p>
          <p className="muted">
            Cria um evento, adiciona os participantes e faz o sorteio. Cada pessoa recebe um link
            pessoal.
          </p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="card-list" aria-label="Eventos guardados">
          {state.data.map((e) => (
            <li key={e.id} className="card">
              <Link to={`/eventos/${e.id}`} className="card-link">
                <span className="card-title">{e.name}</span>
                <span className="muted">
                  {formatDate(e.exchangeDate)} · {formatBudget(e.budgetCents, e.minBudgetCents)} ·{' '}
                  {e.participants.length} participante{e.participants.length === 1 ? '' : 's'}
                  {e.draw ? ' · sorteado' : ''}
                </span>
              </Link>
              <Button
                variant="ghost"
                aria-label={`Apagar ${e.name}`}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Apagar evento?',
                    message: (
                      <p>
                        O evento <strong>{e.name}</strong> vai ser apagado deste dispositivo. Os
                        links já enviados continuam a abrir, mas deixas de os poder voltar a
                        partilhar.
                      </p>
                    ),
                    confirmLabel: 'Apagar',
                    danger: true,
                  });
                  if (ok)
                    await remove(e.id).catch(() =>
                      showStatus('Não foi possível apagar. Verifica a ligação.'),
                    );
                }}
              >
                Apagar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
      {status}
    </Layout>
  );
}
