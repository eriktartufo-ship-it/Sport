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
