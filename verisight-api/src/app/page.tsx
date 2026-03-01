import TestPanel from "../components/TestPanel";

export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        VeriSight Backend Dashboard
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        AI-powered media verification backend
      </p>

      <TestPanel />

      <div style={{ marginTop: 40, fontSize: 14, color: "#888" }}>
        <p>API Endpoint:</p>
        <code>POST /api/analyze</code>
      </div>
    </main>
  );
}