import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { participantById, runDraw, type GiftEvent, type ParticipantId } from '../../domain';
import { buildRevealUrl, copyText, shareLink, useLinkService } from '../../links';
import { mailtoUrl, useMailer, type Delivery } from '../../notify';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Layout } from '../components/Layout';
import { useStatus } from '../components/StatusMessage';
import { useEvent } from '../hooks/useEvents';
import { NotFoundPage } from './NotFoundPage';

/** Base da app sem o fragmento, ex.: https://user.github.io/Mystery-gift/ */
const appBaseUrl = () => `${window.location.origin}${window.location.pathname}`;

type Codes = { drawId: string; map: Map<ParticipantId, string> } | { drawId: string; error: true };
type Deliveries = { drawId: string; map: Map<ParticipantId, Delivery> };

export function ResultPage() {
  const { id } = useParams();
  const { state, update } = useEvent(id);
  const [dialog, confirm] = useConfirm();
  const [status, showStatus] = useStatus(4000);
  const links = useLinkService();
  const mailer = useMailer();
  const [codes, setCodes] = useState<Codes | null>(null);
  const [deliveries, setDeliveries] = useState<Deliveries | null>(null);
  const [sending, setSending] = useState<'all' | ParticipantId | null>(null);

  const event = state.status === 'ready' ? state.data : null;
  const drawId = event?.draw?.id;

  useEffect(() => {
    if (!event || !drawId) return;
    let alive = true;
    links.codesFor(event).then(
      (map) => alive && setCodes({ drawId, map }),
      () => alive && setCodes({ drawId, error: true }),
    );
    return () => {
      alive = false;
    };
    // Só volta a gerar quando o sorteio muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, event?.id, drawId]);

  const loadDeliveries = useCallback(
    async (e: GiftEvent) => {
      if (!mailer || !e.draw) return;
      try {
        setDeliveries({ drawId: e.draw.id, map: await mailer.deliveries(e) });
      } catch {
        /* sem estado: mostra "por enviar" */
      }
    },
    [mailer],
  );

  useEffect(() => {
    if (event && drawId) void loadDeliveries(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeliveries, event?.id, drawId]);

  if (state.status === 'loading') return <Layout title="A carregar…">{null}</Layout>;
  if (state.status === 'error' || !event) return <NotFoundPage />;
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
  const draw = event.draw;

  const repeat = async () => {
    const ok = await confirm({
      title: 'Repetir o sorteio?',
      message: (
        <>
          <p>
            <strong>Os links e códigos antigos deixam de corresponder ao resultado atual.</strong>{' '}
            Quem já abriu o seu link ou leu o e-mail vai ficar com um nome que já não é o certo.
          </p>
          <p>Tens de voltar a enviar o resultado a todos os participantes.</p>
        </>
      ),
      confirmLabel: 'Repetir sorteio',
      danger: true,
    });
    if (!ok) return;
    try {
      await update((e) => runDraw(e));
      showStatus('Novo sorteio feito. Envia o resultado a todos outra vez.');
    } catch {
      showStatus('Não foi possível repetir o sorteio. Verifica a ligação à internet.');
    }
  };

  const currentDeliveries =
    deliveries?.drawId === draw.id ? deliveries.map : new Map<ParticipantId, Delivery>();
  const pending = event.participants.filter(
    (p) => currentDeliveries.get(p.id)?.status !== 'sent',
  ).length;

  const send = async (giverIds?: ParticipantId[]) => {
    if (!mailer) return;
    setSending(giverIds?.[0] ?? 'all');
    try {
      const results = await mailer.send(event, giverIds ? { giverIds, resend: true } : {});
      const sent = results.filter((r) => r.status === 'sent').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      showStatus(
        failed
          ? `${sent} enviado${sent === 1 ? '' : 's'}, ${failed} falhou${failed === 1 ? '' : 'aram'}.`
          : sent === 1
            ? 'E-mail enviado.'
            : `${sent} e-mails enviados.`,
      );
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setSending(null);
      await loadDeliveries(event);
    }
  };

  const ready = codes && 'map' in codes && codes.drawId === draw.id ? codes.map : null;

  return (
    <Layout title="Enviar o resultado" back={back}>
      <section className="section" aria-labelledby="email-titulo">
        <h2 id="email-titulo">Por e-mail</h2>
        {mailer ? (
          <>
            <p>
              Cada pessoa recebe um e-mail com o link do envelope e, no fim, o nome de quem lhe
              calhou. Tu não vês os pares.
            </p>
            {pending > 0 ? (
              <Button
                variant="primary"
                onClick={() => send()}
                disabled={sending !== null || !ready}
                aria-busy={sending === 'all'}
              >
                {sending === 'all'
                  ? 'A enviar…'
                  : pending === event.participants.length
                    ? `Enviar e-mails a todos (${pending})`
                    : `Enviar aos que faltam (${pending})`}
              </Button>
            ) : (
              <p className="chip chip-ok">Todos os e-mails foram enviados</p>
            )}
          </>
        ) : (
          <p className="alert alert-warning">
            O envio automático ainda não está ligado. O botão «Enviar por e-mail» abre a tua app de
            e-mail com a mensagem pronta; só tens de carregar em enviar.{' '}
            <strong>Ao fazê-lo, vais ver o nome de quem calhou a cada pessoa.</strong>
          </p>
        )}
      </section>

      {(!codes || codes.drawId !== draw.id) && <p aria-busy="true">A preparar os links…</p>}
      {codes && 'error' in codes && codes.drawId === draw.id && (
        <p className="alert alert-error" role="alert">
          Não foi possível gerar os links. Verifica a ligação à internet e tenta outra vez.
        </p>
      )}
      {ready && (
        <ul className="card-list" aria-label="Participantes">
          {event.participants.map((p) => {
            const code = ready.get(p.id);
            if (!code) return null;
            const url = buildRevealUrl(code, appBaseUrl());
            const text = `Olá ${p.name}! Este é o teu link do amigo secreto «${event.name}». Não o mostres a ninguém 🤫`;
            const delivery = currentDeliveries.get(p.id);
            const assignment = draw.assignments.find((a) => a.giverId === p.id);
            const receiver = assignment && participantById(event, assignment.receiverId);
            const copy = async (value: string, what: string) =>
              showStatus(
                (await copyText(value))
                  ? `${what} de ${p.name} copiado`
                  : 'Não foi possível copiar',
              );
            return (
              <li key={p.id} className="card card-result">
                <div className="card-head">
                  <span className="card-title">{p.name}</span>
                  {mailer && <DeliveryChip delivery={delivery} />}
                </div>
                <span className="participant-email">{p.email || 'Sem e-mail'}</span>
                {delivery?.status === 'failed' && delivery.error && (
                  <span className="field-error">{delivery.error}</span>
                )}
                <div className="actions actions-wrap">
                  {!mailer && p.email && receiver ? (
                    <a
                      className="btn btn-primary"
                      href={mailtoUrl(p.email, {
                        eventName: event.name,
                        giverName: p.name,
                        receiverName: receiver.name,
                        budgetCents: event.budgetCents,
                        minBudgetCents: event.minBudgetCents,
                        exchangeDate: event.exchangeDate,
                        link: url,
                      })}
                      aria-label={`Enviar por e-mail a ${p.name}`}
                    >
                      Enviar por e-mail
                    </a>
                  ) : null}
                  <Button
                    variant={mailer ? 'primary' : 'secondary'}
                    onClick={() => shareLink({ title: `Amigo secreto: ${event.name}`, text, url })}
                    aria-label={`Partilhar link com ${p.name}`}
                  >
                    Partilhar
                  </Button>
                  <Button onClick={() => copy(url, 'Link')} aria-label={`Copiar link de ${p.name}`}>
                    Copiar link
                  </Button>
                  <Button
                    onClick={() => copy(links.displayCode(code), 'Código')}
                    aria-label={`Copiar código de ${p.name}`}
                  >
                    Copiar código
                  </Button>
                  {mailer && (
                    <Button
                      onClick={() => send([p.id])}
                      disabled={sending !== null}
                      aria-busy={sending === p.id}
                      aria-label={`${delivery ? 'Reenviar' : 'Enviar'} e-mail a ${p.name}`}
                    >
                      {sending === p.id
                        ? 'A enviar…'
                        : delivery
                          ? 'Reenviar e-mail'
                          : 'Enviar e-mail'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="section">
        <h2>Repetir sorteio</h2>
        <p className="muted">Faz um sorteio novo. Os links e e-mails antigos deixam de valer.</p>
        <Button variant="danger" onClick={repeat}>
          Repetir sorteio
        </Button>
      </section>
      {dialog}
      {status}
    </Layout>
  );
}

function DeliveryChip({ delivery }: { delivery: Delivery | undefined }) {
  if (!delivery) return <span className="chip chip-neutral">Por enviar</span>;
  if (delivery.status === 'sent') return <span className="chip chip-ok">E-mail enviado</span>;
  return <span className="chip chip-error">Falhou</span>;
}
