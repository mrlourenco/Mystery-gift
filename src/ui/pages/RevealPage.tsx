import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, formatEuros } from '../../domain';
import { useLinkService, type RevealResult } from '../../links';
import { Envelope } from '../components/Envelope';
import { Layout } from '../components/Layout';

export function RevealPage() {
  const { code = '' } = useParams();
  const links = useLinkService();
  const [result, setResult] = useState<{ code: string; r: RevealResult } | null>(null);

  useEffect(() => {
    let alive = true;
    links
      .resolve(code)
      .catch((): RevealResult => ({ status: 'error', message: 'Erro inesperado.' }))
      .then((r) => alive && setResult({ code, r }));
    return () => {
      alive = false;
    };
  }, [links, code]);

  if (!result || result.code !== code) {
    return (
      <Layout title="A abrir…">
        <p aria-busy="true">A procurar o teu envelope…</p>
      </Layout>
    );
  }

  const r = result.r;

  if (r.status === 'error') {
    return (
      <Layout title="Sem ligação">
        <p className="alert alert-error" role="alert">
          Não foi possível abrir o envelope. Verifica a ligação à internet e tenta outra vez.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => location.reload()}>
          Tentar outra vez
        </button>
      </Layout>
    );
  }

  if (r.status === 'stale') {
    return (
      <Layout title={`Olá, ${r.giverName}!`}>
        <p className="alert alert-warning" role="alert">
          O sorteio de <strong>{r.eventName}</strong> foi repetido e este link já não é válido. Pede
          o novo link a quem organizou.
        </p>
      </Layout>
    );
  }

  if (r.status === 'invalid') {
    return (
      <Layout title="Link inválido">
        <p className="alert alert-error" role="alert">
          Este link ou código não existe, está incompleto ou foi alterado.
        </p>
        <p>Pede um novo link a quem organizou, ou tenta colar o código.</p>
        <Link className="btn btn-primary" to="/codigo">
          Tenho um código
        </Link>
      </Layout>
    );
  }

  const { data, isCurrent } = r;
  return (
    <Layout title={`Olá, ${data.giverName}!`}>
      <p className="lead">
        Tens um envelope do amigo secreto <strong>{data.eventName}</strong>.
      </p>
      {isCurrent === false && (
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
