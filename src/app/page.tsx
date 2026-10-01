import Link from 'next/link';
import { SPORTS } from '@/lib/sports';

export default function Home() {
  return (
    <div className="home-wrap">
      <h1 className="title">Seleziona uno Sport</h1>

      <div className="home-sport-list">
        {SPORTS.map((s) => (
          <Link key={s.href} href={s.href} className="sport-card">
            <div className="sport-card-head">
              <span className="sport-card-icon" aria-hidden="true">{s.icon}</span>
              <h2 className="sport-card-title">{s.name}</h2>
            </div>
            <p className="sport-card-desc">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
