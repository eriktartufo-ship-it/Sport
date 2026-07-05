import Link from 'next/link';

export default function Home() {
  return (
    <div className="home-wrap">
      <h1 className="title">Seleziona uno Sport</h1>

      <div className="home-sport-list">
        <Link href="/ko" className="sport-card">
          <div className="sport-card-head">
            <span className="sport-card-icon" aria-hidden="true">🏀</span>
            <h2 className="sport-card-title">K.O.</h2>
          </div>
          <p className="sport-card-desc">
            Il classico gioco a eliminazione del Basket. Vinci medaglie e scala le classifiche.
          </p>
        </Link>

        <Link href="/3v3" className="sport-card">
          <div className="sport-card-head">
            <span className="sport-card-icon" aria-hidden="true">🤝</span>
            <h2 className="sport-card-title">3vs3</h2>
          </div>
          <p className="sport-card-desc">
            Basket 3 contro 3, regolamento FIBA 3x3. Squadre, punti e classifiche per combinazione + per persona.
          </p>
        </Link>

        <Link href="/machiavelli" className="sport-card">
          <div className="sport-card-head">
            <span className="sport-card-icon" aria-hidden="true">🃏</span>
            <h2 className="sport-card-title">Machiavelli</h2>
          </div>
          <p className="sport-card-desc">
            Il gioco di carte: chi resta con le carte in mano perde. Tieni il conto di chi vince più spesso.
          </p>
        </Link>

        <div className="sport-card sport-card-disabled">
          <div className="sport-card-head">
            <span className="sport-card-icon" aria-hidden="true">⚽</span>
            <h2 className="sport-card-title">Prossimamente</h2>
          </div>
          <p className="sport-card-desc">Nuovi sport verranno aggiunti in futuro.</p>
        </div>
      </div>
    </div>
  );
}
