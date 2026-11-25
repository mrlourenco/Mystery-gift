import { participantById, type GiftEvent, type ParticipantId } from '../domain';
import type { EventRepository } from '../data/EventRepository';
import { decodeReveal, encodeReveal } from './codec';
import { extractCode, type LinkService, type RevealResult } from './LinkService';

/** Fase 1: o resultado vai codificado (ofuscado) dentro do próprio link. */
export class LocalLinkService implements LinkService {
  /** O repositório é opcional e serve só para detetar links antigos no dispositivo de quem organizou. */
  constructor(private readonly repo?: EventRepository) {}

  async codesFor(event: GiftEvent): Promise<Map<ParticipantId, string>> {
    const codes = new Map<ParticipantId, string>();
    if (!event.draw) return codes;
    for (const a of event.draw.assignments) {
      const giver = participantById(event, a.giverId);
      const receiver = participantById(event, a.receiverId);
      if (!giver || !receiver) continue;
      codes.set(
        giver.id,
        encodeReveal({
          eventName: event.name,
          budgetCents: event.budgetCents,
          minBudgetCents: event.minBudgetCents ?? null,
          exchangeDate: event.exchangeDate,
          giverName: giver.name,
          receiverName: receiver.name,
          drawId: event.draw.id,
        }),
      );
    }
    return codes;
  }

  displayCode(code: string): string {
    return code;
  }

  parseInput(input: string): string | null {
    const code = extractCode(input);
    try {
      decodeReveal(code);
      return code;
    } catch {
      return null;
    }
  }

  async resolve(code: string): Promise<RevealResult> {
    let data;
    try {
      data = decodeReveal(code);
    } catch {
      return { status: 'invalid' };
    }
    let isCurrent: boolean | null = null;
    if (this.repo) {
      try {
        const events = await this.repo.list();
        if (events.some((e) => e.draw?.id === data.drawId)) isCurrent = true;
        else if (events.some((e) => e.name === data.eventName && e.draw)) isCurrent = false;
      } catch {
        /* sem verificação */
      }
    }
    return { status: 'ok', data, isCurrent };
  }
}
