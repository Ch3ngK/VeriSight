"use client";

import { useState, useEffect } from "react";

export default function TestPanel() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  async function loadLogs() {
  const res = await fetch("/api/logs", {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  });
  const data = await res.json();
  setLogs(data);
}

useEffect(() => {
  loadLogs(); // initial
  const id = setInterval(loadLogs, 1500); // every 1.5s
  return () => clearInterval(id);
}, []);

  async function runTest() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url: "manual-test",
          transcript,
        }),
      });

      const data = await res.json();
      setResult(data);
      await loadLogs();
    } catch (err) {
      setResult({ error: "Request failed" });
    }

    setLoading(false);
  }

  return (
    <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
      <h2>Manual Test</h2>

      <input
        placeholder="Video Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <textarea
        placeholder="Paste transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={runTest} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {/* AI Result */}
      {result && (
        <pre
          style={{
            marginTop: 20,
            background: "#111",
            color: "#0f0",
            padding: 10,
            overflow: "auto",
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {/* Request Logs */}
      <h3 style={{ marginTop: 30 }}>Recent Requests</h3>

      {logs.length === 0 && (
        <div style={{ fontSize: 13, color: "#777" }}>No requests yet.</div>
      )}

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            border: "1px solid #ddd",
            padding: 10,
            marginTop: 8,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div><strong>{log.title}</strong></div>
          <div>Transcript Length: {log.transcriptLength}</div>
          <div>Processing Time: {log.durationMs} ms</div>
          <div>
            Time: {new Date(log.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}

async function loadStats() {
  const res = await fetch("/api/stats", { cache: "no-store" });
  return await res.json();
}