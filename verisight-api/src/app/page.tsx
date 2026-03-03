import TestPanel from "../components/TestPanel";

export default function Home() {
  return (
    <main style={{ padding: "var(--space-xl)", fontFamily: "var(--font-family)", background: "var(--background)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 8, color: "#0B0C0E" }}>
          VeriSight Backend Dashboard
        </h1>
        <p style={{ color: "var(--muted-text)", marginBottom: 32, fontSize: 16 }}>
          AI-powered media verification backend
        </p>

        <TestPanel />

        <div style={{ marginTop: 40, fontSize: 14, color: "#888" }}>
          <p>API Endpoint:</p>
          <code style={{ background: "rgba(11,12,14,0.04)", padding: "2px 6px", borderRadius: 4 }}>POST /api/analyze</code>
        </div>
      </div>
    </main>
  );
}