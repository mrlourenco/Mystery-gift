import { useState, type FormEvent } from 'react';
import {
  validateParticipant,
  type Participant,
  type ParticipantErrors,
  type ParticipantId,
  type ParticipantInput,
} from '../../domain';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';

const EMPTY: ParticipantInput = { name: '', email: '' };

export function ParticipantsEditor({
  participants,
  onAdd,
  onUpdate,
  onRemove,
}: {
  participants: Participant[];
  onAdd: (input: ParticipantInput) => Promise<boolean>;
  onUpdate: (id: ParticipantId, input: ParticipantInput) => Promise<boolean>;
  onRemove: (p: Participant) => Promise<void>;
}) {
  const [form, setForm] = useState<ParticipantInput>(EMPTY);
  const [errors, setErrors] = useState<ParticipantErrors>({});
  const [editing, setEditing] = useState<ParticipantId | null>(null);

  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    const errs = validateParticipant(form, participants);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const submitted = form;
    setForm(EMPTY);
    if (!(await onAdd(submitted))) setForm((cur) => (cur.name || cur.email ? cur : submitted));
  };

  return (
    <section aria-labelledby="participantes-titulo" className="section">
      <h2 id="participantes-titulo">
        Participantes <span className="badge">{participants.length}</span>
      </h2>
      <form onSubmit={add} noValidate className="participant-form">
        <TextField
          label="Nome"
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          autoComplete="off"
          maxLength={50}
          error={errors.name}
        />
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          value={form.email}
          onChange={(e) => {
            setForm({ ...form, email: e.target.value });
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          autoComplete="off"
          maxLength={254}
          error={errors.email}
        />
        <Button type="submit" variant="primary">
          Adicionar
        </Button>
      </form>
      <p className="field-hint">
        O e-mail só é usado para enviar a cada pessoa o resultado do sorteio.
      </p>

      {participants.length === 0 ? (
        <p className="muted">Ainda sem participantes.</p>
      ) : (
        <ul className="participant-list">
          {participants.map((p) =>
            editing === p.id ? (
              <EditRow
                key={p.id}
                participant={p}
                all={participants}
                onCancel={() => setEditing(null)}
                onSave={async (input) => {
                  if (await onUpdate(p.id, input)) setEditing(null);
                }}
              />
            ) : (
              <li key={p.id} className="participant">
                <span className="participant-info">
                  <span className="participant-name">{p.name}</span>
                  {p.email ? (
                    <span className="participant-email">{p.email}</span>
                  ) : (
                    <span className="chip chip-warning">Falta o e-mail</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(p.id)}
                  aria-label={`Editar ${p.name}`}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onRemove(p)}
                  aria-label={`Remover ${p.name}`}
                >
                  Remover
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function EditRow({
  participant,
  all,
  onSave,
  onCancel,
}: {
  participant: Participant;
  all: Participant[];
  onSave: (input: ParticipantInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<ParticipantInput>({
    name: participant.name,
    email: participant.email ?? '',
  });
  const [errors, setErrors] = useState<ParticipantErrors>({});
  return (
    <li className="participant participant-editing">
      <form
        className="participant-form"
        noValidate
        onSubmit={async (ev) => {
          ev.preventDefault();
          const errs = validateParticipant(value, all, participant.id);
          setErrors(errs);
          if (!Object.keys(errs).length) await onSave(value);
        }}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <TextField
          label={`Nome de ${participant.name}`}
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          autoFocus
          maxLength={50}
          error={errors.name}
        />
        <TextField
          label={`E-mail de ${participant.name}`}
          type="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          value={value.email}
          onChange={(e) => setValue({ ...value, email: e.target.value })}
          maxLength={254}
          error={errors.email}
        />
        <div className="actions actions-tight">
          <Button type="submit" variant="primary">
            Guardar
          </Button>
          <Button onClick={onCancel}>Cancelar</Button>
        </div>
      </form>
    </li>
  );
}
