import { participantById, type GiftEvent, type Participant } from '../domain';
import { encodeReveal } from '../links';

/** Código do link pessoal de `giver` no sorteio atual (null se não houver sorteio). */
export function codeFor(event: GiftEvent, giver: Participant): string | null {
  const a = event.draw?.assignments.find((x) => x.giverId === giver.id);
  const receiver = a && participantById(event, a.receiverId);
  if (!event.draw || !receiver) return null;
  return encodeReveal({
    eventName: event.name,
    budgetCents: event.budgetCents,
    exchangeDate: event.exchangeDate,
    giverName: giver.name,
    receiverName: receiver.name,
    drawId: event.draw.id,
  });
}
