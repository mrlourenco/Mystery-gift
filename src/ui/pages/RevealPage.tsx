import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, formatEuros } from '../../domain';
import { useEventRepository } from '../../data';
import { decodeReveal, type RevealData } from '../../links';
import { Envelope } from '../components/Envelope';
import { Layout } from '../components/Layout';

export function RevealPage() {
  const { code = '' } = useParams();
  const data = useMemo<RevealData | null>(() => {
    try {
      return decodeReveal(code);
    } catch {
      return null;
    }
  }, [code]);
  const stale = useStaleCheck(data);

  if (!data) {
    return (
      <Layout title="Link inválido">
        <p className="alert alert-error" role="alert">
          Este link ou código está incompleto ou foi alterado.
        </p>
        <p>Pede um novo link a quem organizou, ou tenta colar o código.</p>
        <Link className="btn btn-primary" to="/codigo">
          Tenho um código
        </Link>
      </Layout>
    );
  }

  return (
    <Layout title={`Olá, ${data.giverName}!`}>
      <p className="lead">
        Tens um envelope do amigo secreto <strong>{data.eventName}</strong>.
      </p>
      {stale && (
        <p className="alert alert-warning">
          Neste dispositivo existe um sorteio mais recente deste evento. Este link pode já não
          corresponder ao resultado atual.
        </p>
      )}
      <Envelope recipientLabel={data.giverName}>
        <div className="reveal-card" aria-live="polite">
          <p className="muted">Vais oferecer um presente a</p>
          <p className="reveal-name">{data.receiverName}</p>
          <dl className="reveal-details">
            <div>
              <dt>Orçamento</dt>
              <dd>até {formatEuros(data.budgetCents)}</dd>
            </div>
            <div>
              <dt>Data da troca</dt>
              <dd>{formatDate(data.exchangeDate)}</dd>
            </div>
          </dl>
          <p className="muted small">Guarda segredo! 🤫</p>
        </div>
      </Envelope>
    </Layout>
  );
}

/** Só funciona no dispositivo de quem organizou: compara o drawId do link com o local. */
function useStaleCheck(data: RevealData | null): boolean {
  const repo = useEventRepository();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!data) return;
    let alive = true;
    repo
      .list()
      .then((events) => {
        const sameName = events.filter((e) => e.name === data.eventName && e.draw);
        const match = events.some((e) => e.draw?.id === data.drawId);
        if (alive) setStale(sameName.length > 0 && !match);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repo, data]);
  return stale;
}
