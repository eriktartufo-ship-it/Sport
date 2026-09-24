/**
 * Scheda Regole del Padel — riassunto veloce da consultare in caso di dubbi
 * durante una partita. Regole di casa confermate da Erik: boccino d'oro al
 * game (40-40); sul 6-6 vantaggi a punti secchi, una battuta a testa, primo a 7
 * con 2 di scarto → valgono un game, set 7-6. Il 5-5 si chiude 7-5. Mai oltre il 7.
 */
export default function PadelRulesCard() {
  return (
    <div className="card padel-rules">
      <h2 className="card-title">Regolamento — riassunto</h2>

      <div className="padel-rule">
        <h3>🎾 In breve</h3>
        <p>Si gioca <strong>2 contro 2</strong>. Le pareti fanno parte del gioco: la palla può
          rimbalzare sui vetri dopo il primo rimbalzo a terra nel proprio campo.</p>
      </div>

      <div className="padel-rule">
        <h3>🔢 Punteggio del game</h3>
        <p>Come nel tennis: <strong>15 → 30 → 40 → game</strong>. Il primo punto vale 15,
          poi 30, poi 40, poi si vince il game.</p>
      </div>

      <div className="padel-rule padel-rule-accent">
        <h3>⭐ 40-40 = boccino d&apos;oro</h3>
        <p>Sul <strong>40 pari</strong> si gioca il <strong>punto d&apos;oro</strong>: un solo
          punto secco decide il game. Chi riceve sceglie il lato da cui rispondere.</p>
      </div>

      <div className="padel-rule padel-rule-accent">
        <h3>🎯 Quando si vince il set</h3>
        <p>Vince il set la coppia che arriva prima a <strong>6 game con almeno 2 di scarto</strong>:
          6-0, 6-1, 6-2, 6-3, <strong>6-4</strong>. Sul <strong>5-5</strong> si gioca fino a
          7: <strong>7-5</strong> chiude il set.</p>
      </div>

      <div className="padel-rule padel-rule-accent">
        <h3>🔥 6-6 → vantaggi, una battuta a testa</h3>
        <p>Sul <strong>6 pari</strong> si va ai <strong>vantaggi a punti secchi</strong>: si
          batte <strong>una volta a testa</strong>, a turno fra tutti e quattro. Vince chi arriva per primo
          a <strong>7 punti con almeno 2 di scarto</strong> (7-5, 8-6, 10-8…). Chi vince i vantaggi
          vince il set <strong>7-6</strong>: i vantaggi valgono <strong>un solo game</strong>,
          quindi un set non va mai oltre il 7.</p>
      </div>

      <div className="padel-rule">
        <h3>✅ Punteggi di un set che l&apos;app accetta</h3>
        <p><strong>6-0 · 6-1 · 6-2 · 6-3 · 6-4 · 7-5 · 7-6</strong>. Nient&apos;altro: 6-5 non è
          finito, e 8-6 non esiste (i vantaggi sul 6-6 contano come un game).</p>
      </div>

      <div className="padel-rule">
        <h3>🏆 Partita</h3>
        <p>Al meglio dei <strong>3 set</strong>: vince chi ne conquista 2. (Potete anche giocare
          a 1 solo set: l&apos;app accetta da 1 a 5 set per partita.)</p>
      </div>

      <div className="padel-rule">
        <h3>🏓 Battuta</h3>
        <p>Si serve <strong>dal basso</strong> (colpo sotto la vita) facendo prima rimbalzare la
          palla a terra. La battuta deve finire in diagonale nel quadrato di servizio avversario.</p>
      </div>
    </div>
  );
}
