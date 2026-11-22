import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { revealPath, useLinkService } from '../../links';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';

export function EnterCodePage() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const id = useId();
  const links = useLinkService();

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const code = links.parseInput(value);
    if (code) navigate(revealPath(code));
    else setError('Código inválido. Confirma que o copiaste por inteiro.');
  };

  return (
    <Layout title="Tenho um código" back={{ to: '/', label: 'Início' }}>
      <p>Se o link não abrir, cola aqui o código (ou o link completo) que recebeste.</p>
      <form onSubmit={submit} noValidate className="form">
        <div className="field">
          <label htmlFor={id}>Código ou link</label>
          <textarea
            id={id}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            rows={4}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          {error && (
            <p id={`${id}-err`} className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={!value.trim()}>
          Abrir envelope
        </Button>
      </form>
    </Layout>
  );
}
