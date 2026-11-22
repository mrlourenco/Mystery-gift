import { useState } from 'react';
import styles from './Envelope.module.css';

export function Envelope({
  recipientLabel,
  children,
}: {
  recipientLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.envelope} ${open ? styles.open : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="revelacao"
        disabled={open}
        aria-label={open ? 'Envelope aberto' : `Abrir envelope de ${recipientLabel}`}
      >
        <span className={styles.back} aria-hidden="true" />
        <span className={styles.letter} aria-hidden="true" />
        <span className={styles.front} aria-hidden="true" />
        <span className={styles.flap} aria-hidden="true" />
        <span className={styles.seal} aria-hidden="true">
          🎁
        </span>
      </button>
      {!open && <p className={styles.hint}>Toca no envelope para abrir</p>}
      <div
        id="revelacao"
        className={`${styles.reveal} ${open ? styles.revealOpen : ''}`}
        hidden={!open}
      >
        {open && children}
      </div>
    </div>
  );
}
