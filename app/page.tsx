// Placeholder until the browsing feed is designed (build plan, Phase 5). The data pipeline runs
// through the /api routes; nothing here reads the database.
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 16px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>AM Intelligence</h1>
      <p style={{ color: '#555', lineHeight: 1.5 }}>
        A structured record of what asset managers publish: themes, asset classes, formats, readability and visual treatment.
        The browsing feed, manager profiles and white-space view are being built.
      </p>
    </main>
  )
}
