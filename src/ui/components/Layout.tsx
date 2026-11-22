import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Layout({
  title,
  back,
  children,
}: {
  title: string;
  back?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="app-header">
        {back ? (
          <Link to={back.to} className="back-link">
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        ) : (
          <Link to="/" className="brand">
            <span aria-hidden="true">🎁</span> Amigo Secreto
          </Link>
        )}
      </header>
      <main id="conteudo" className="container" tabIndex={-1}>
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}
