import { buildDrawEmail, type DrawEmailInput } from '../../supabase/functions/_shared/drawEmail.ts';

/**
 * Alternativa sem servidor: abre a app de e-mail com a mensagem já escrita.
 * Quem organiza envia (e vê o resultado).
 */
export function mailtoUrl(to: string, input: DrawEmailInput): string {
  const { subject, text } = buildDrawEmail(input);
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  // O endereço já foi validado (sem espaços nem caracteres especiais de URL).
  return `mailto:${to}?${q}`;
}
