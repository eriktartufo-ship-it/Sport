/**
 * Scheda Regole del Padel — riassunto veloce da consultare in caso di dubbi
 * durante una partita. Regole di casa confermate da Erik: boccino d'oro al
 * game (40-40), vantaggi al set (6-6 → si va a oltranza, niente tie-break).
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
        <h3>🎯 Set → vantaggi (niente tie-break)</h3>
        <p>Vince il set la coppia che arriva prima a <strong>6 game con almeno 2 di scarto</strong>
          (es. 6-4, 6-2). Sul <strong>6-6</strong> si va ai <strong>vantaggi</strong>: si continua a
          giocare finché una coppia non stacca l&apos;altra di <strong>2 game</strong>
          (7-5, 8-6, 10-8…). Niente tie-break.</p>
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
