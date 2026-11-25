import type { GiftEvent, ParticipantId } from '../domain';

export interface Delivery {
  giverId: ParticipantId;
  status: 'sent' | 'failed';
  error: string | null;
  updatedAt: string;
}

export interface SendResult {
  giverId: ParticipantId;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

/** Envio do resultado por e-mail a partir de um servidor (Supabase + Resend). */
export interface DrawMailer {
  /** Estado dos envios do sorteio atual, por participante. */
  deliveries(event: GiftEvent): Promise<Map<ParticipantId, Delivery>>;
  /**
   * Envia aos participantes indicados (ou a todos os que ainda não receberam).
   * `resend` volta a enviar mesmo a quem já recebeu.
   */
  send(
    event: GiftEvent,
    opts?: { giverIds?: ParticipantId[]; resend?: boolean },
  ): Promise<SendResult[]>;
}

export class MailerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailerError';
  }
}
