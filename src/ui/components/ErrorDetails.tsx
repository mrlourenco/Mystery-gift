/** Texto técnico de um erro (Error, PostgrestError, AuthError…), para diagnóstico. */
function describe(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const e = error as {
    name?: string;
    code?: string;
    status?: number;
    message?: string;
    hint?: string;
  };
  return [e.code ?? e.status ?? e.name, e.message, e.hint].filter(Boolean).join(' · ');
}

export function ErrorDetails({ error }: { error: unknown }) {
  const text = describe(error);
  if (!text) return null;
  return (
    <details className="error-details">
      <summary>Detalhes técnicos</summary>
      <code>{text}</code>
    </details>
  );
}
