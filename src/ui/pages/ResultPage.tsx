import { Link, useParams } from 'react-router-dom';
import { runDraw } from '../../domain';
import { buildRevealUrl, copyText, shareLink } from '../../links';
import { codeFor } from '../revealCode';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Layout } from '../components/Layout';
import { useStatus } from '../components/StatusMessage';
import { useEvent } from '../hooks/useEvents';
import { NotFoundPage } from './NotFoundPage';

/** Base da app sem o fragmento, ex.: https://user.github.io/Mystery-gift/ */
const appBaseUrl = () => `${window.location.origin}${window.location.pathname}`;

export function ResultPage() {
  const { id } = useParams();
  const { state, update } = useEvent(id);
  const [dialog, confirm] = useConfirm();
  const [status, showStatus] = useStatus();

  if (state.status === 'loading') return <Layout title="A carregar…">{null}</Layout>;
  if (state.status === 'error' || !state.data) return <NotFoundPage />;
  const event = state.data;
  const back = { to: `/eventos/${event.id}`, label: event.name };

  if (!event.draw) {
    return (
      <Layout title="Ainda sem sorteio" back={back}>
        <p>Faz o sorteio na página do evento para gerar os links.</p>
        <Link className="btn btn-primary" to={back.to}>
          Voltar ao evento
        </Link>
      </Layout>
    );
  }

  const repeat = async () => {
    const ok = await confirm({
      title: 'Repetir o sorteio?',
      message: (
        <>
          <p>
            <strong>Os links e códigos antigos deixam de corresponder ao resultado atual.</strong>{' '}
            Quem já abriu o seu link vai ficar com um nome que já não é o certo.
          </p>
          <p>Tens de voltar a enviar o novo link a todos os participantes.</p>
        </>
      ),
      confirmLabel: 'Repetir sorteio',
      danger: true,
    });
    if (ok) {
      await update((e) => runDraw(e));
      showStatus('Novo sorteio feito. Envia os novos links a todos.');
    }
  };

  return (
    <Layout title="Links pessoais" back={back}>
      <p>
        Envia a cada pessoa <strong>o seu</strong> link. Quem o abrir vê só o nome de quem lhe
        calhou. Os pares não são mostrados aqui, para que também tu tenhas surpresa.
      </p>
      <ul className="card-list" aria-label="Links por participante">
        {event.participants.map((p) => {
          const code = codeFor(event, p);
          if (!code) return null;
          const url = buildRevealUrl(code, appBaseUrl());
          const text = `Olá ${p.name}! Este é o teu link do amigo secreto «${event.name}». Não o mostres a ninguém 🤫`;
          return (
            <li key={p.id} className="card card-result">
              <span className="card-title">{p.name}</span>
              <div className="actions actions-wrap">
                <Button
                  onClick={async () =>
                    showStatus(
                      (await copyText(url))
                        ? `Link de ${p.name} copiado`
                        : 'Não foi possível copiar',
                    )
                  }
                  aria-label={`Copiar link de ${p.name}`}
                >
                  Copiar link
                </Button>
                <Button
                  variant="primary"
                  onClick={() => shareLink({ title: `Amigo secreto: ${event.name}`, text, url })}
                  aria-label={`Partilhar link com ${p.name}`}
                >
                  Partilhar
                </Button>
                <Button
                  onClick={async () =>
                    showStatus(
                      (await copyText(code))
                        ? `Código de ${p.name} copiado`
                        : 'Não foi possível copiar',
                    )
                  }
                  aria-label={`Copiar código de ${p.name}`}
                >
                  Copiar código
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="section">
        <h2>Repetir sorteio</h2>
        <p className="muted">Faz um sorteio novo. Os links antigos deixam de valer.</p>
        <Button variant="danger" onClick={repeat}>
          Repetir sorteio
        </Button>
      </section>
      {dialog}
      {status}
    </Layout>
  );
}
