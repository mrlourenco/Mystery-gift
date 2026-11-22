import { useState, type FormEvent } from 'react';
import { validateParticipantName, type Participant, type ParticipantId } from '../../domain';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';

export function ParticipantsEditor({
  participants,
  onAdd,
  onRename,
  onRemove,
}: {
  participants: Participant[];
  onAdd: (name: string) => Promise<boolean>;
  onRename: (id: ParticipantId, name: string) => Promise<boolean>;
  onRemove: (p: Participant) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ParticipantId | null>(null);

  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    const v = validateParticipantName(name, participants);
    if (!v.ok) return setError(v.error);
    setError(null);
    const submitted = name;
    setName('');
    if (!(await onAdd(submitted))) setName((cur) => cur || submitted);
  };

  return (
    <section aria-labelledby="participantes-titulo" className="section">
      <h2 id="participantes-titulo">
        Participantes <span className="badge">{participants.length}</span>
      </h2>
      <form onSubmit={add} noValidate className="inline-form">
        <TextField
          label="Nome do participante"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          maxLength={50}
          error={error}
          className="grow"
        />
        <Button type="submit" variant="primary">
          Adicionar
        </Button>
      </form>

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
                onSave={async (n) => {
                  if (await onRename(p.id, n)) setEditing(null);
                }}
              />
            ) : (
              <li key={p.id} className="participant">
                <span className="participant-name">{p.name}</span>
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
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(participant.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="participant participant-editing">
      <form
        className="inline-form"
        noValidate
        onSubmit={async (ev) => {
          ev.preventDefault();
          const v = validateParticipantName(value, all, participant.id);
          if (!v.ok) return setError(v.error);
          await onSave(value);
        }}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <TextField
          label={`Novo nome para ${participant.name}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          maxLength={50}
          error={error}
          className="grow"
        />
        <Button type="submit" variant="primary">
          Guardar
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </form>
    </li>
  );
}
