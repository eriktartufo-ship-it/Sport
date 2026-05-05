import Link from 'next/link';

export default function KOLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link href="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>&larr; Torna alla Home</Link>
      </nav>
      {children}
    </div>
  )
}
