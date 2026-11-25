import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type { GiftEvent, ParticipantId } from '../domain';
import { MailerError, type Delivery, type DrawMailer, type SendResult } from '../notify/DrawMailer';

export class SupabaseDrawMailer implements DrawMailer {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ensureSession: () => Promise<unknown>,
  ) {}

  async deliveries(event: GiftEvent): Promise<Map<ParticipantId, Delivery>> {
    const map = new Map<ParticipantId, Delivery>();
    if (!event.draw) return map;
    await this.ensureSession();
    const { data, error } = await this.supabase
      .from('email_deliveries')
      .select('giver_id, status, error, updated_at')
      .eq('event_id', event.id)
      .eq('draw_id', event.draw.id);
    if (error) throw error;
    for (const r of data as {
      giver_id: string;
      status: 'sent' | 'failed';
      error: string | null;
      updated_at: string;
    }[]) {
      map.set(r.giver_id, {
        giverId: r.giver_id,
        status: r.status,
        error: r.error,
        updatedAt: r.updated_at,
      });
    }
    return map;
  }

  async send(
    event: GiftEvent,
    opts: { giverIds?: ParticipantId[]; resend?: boolean } = {},
  ): Promise<SendResult[]> {
    await this.ensureSession();
    const { data, error } = await this.supabase.functions.invoke<{ results: SendResult[] }>(
      'send-draw-emails',
      { body: { eventId: event.id, giverIds: opts.giverIds, resend: opts.resend ?? false } },
    );
    if (error) {
      let message = 'Não foi possível enviar os e-mails. Verifica a ligação à internet.';
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        if (res.status === 404 && !body?.error)
          message =
            'O envio automático de e-mails ainda não está ativo no servidor. Usa «Partilhar» ou «Copiar link».';
        else if (body?.error) message = body.error;
        else if (body?.message) message = body.message;
      }
      throw new MailerError(message);
    }
    return data?.results ?? [];
  }
}
