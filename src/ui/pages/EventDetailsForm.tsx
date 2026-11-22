import { useState, type FormEvent } from 'react';
import {
  formatEuros,
  parseEuros,
  validateEventDetails,
  type EventDetails,
  type EventDetailsErrors,
} from '../../domain';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';

const centsToInput = (c: number) => (c ? (c / 100).toFixed(c % 100 ? 2 : 0).replace('.', ',') : '');

export function EventDetailsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: EventDetails;
  submitLabel: string;
  onSubmit: (d: EventDetails) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [budget, setBudget] = useState(initial ? centsToInput(initial.budgetCents) : '');
  const [date, setDate] = useState(initial?.exchangeDate ?? '');
  const [errors, setErrors] = useState<EventDetailsErrors>({});

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const details: EventDetails = {
      name,
      budgetCents: parseEuros(budget) ?? NaN,
      exchangeDate: date,
    };
    const errs = validateEventDetails(details);
    setErrors(errs);
    if (Object.keys(errs).length === 0) await onSubmit(details);
  };

  const parsed = parseEuros(budget);

  return (
    <form onSubmit={submit} noValidate className="form">
      <TextField
        label="Nome do evento"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex.: Natal da família"
        autoComplete="off"
        maxLength={80}
        required
        error={errors.name}
      />
      <TextField
        label="Orçamento máximo (€)"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        inputMode="decimal"
        placeholder="Ex.: 20"
        autoComplete="off"
        required
        hint={parsed ? `Até ${formatEuros(parsed)} por presente` : undefined}
        error={errors.budgetCents}
      />
      <TextField
        label="Data da troca"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        error={errors.exchangeDate}
      />
      <Button type="submit" variant="primary">
        {submitLabel}
      </Button>
    </form>
  );
}
