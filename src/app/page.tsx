import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <h1 className="title">Seleziona uno Sport</h1>
      <p style={{ marginBottom: '3rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '600px' }}>
        Benvenuto nel nuovo tracker sportivo. Attualmente è disponibile il modulo per il gioco del K.O. (Basket). 
        Scegli lo sport per visualizzare le statistiche e aggiungere nuove partite.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', width: '100%', maxWidth: '800px' }}>
        
        <Link href="/ko" style={{ display: 'block' }}>
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', cursor: 'pointer' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏀</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>K.O.</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>
              Il classico gioco a eliminazione del Basket. 
              Vinci medaglie e scala le classifiche.
            </p>
          </div>
        </Link>

        {/* Future sport placeholder */}
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', opacity: 0.5 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚽</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Prossimamente</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>
            Nuovi sport verranno aggiunti in futuro.
          </p>
        </div>

      </div>
    </div>
  );
}
