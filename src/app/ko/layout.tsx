export default function KOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Niente "Torna alla home": il brand 🏀 Sport in alto-sinistra
  // dell'AuthHeader (globale) già fa da link alla home.
  return <div>{children}</div>;
}
