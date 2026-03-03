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
    <div className="vs-popup-card">
      <div className="vs-popup-accent-bar" aria-hidden="true" />
      <div className="vs-header">
        <span className="vs-title">Manual Test</span>
        <span className="vs-chip">CRISIS MODE: OFF</span>
      </div>

      <div className="vs-section">
        <div className="vs-section-heading">Overview</div>
        <div className="vs-card vs-overview vs-empty">Enter a video title and transcript to analyze.</div>
      </div>

      <div className="vs-section">
        <div className="vs-section-heading">Input</div>
        <div className="vs-card">
          <input
            className="vs-input"
            placeholder="Video Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <textarea
            className="vs-input"
            placeholder="Paste transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <button className="vs-btn" onClick={runTest} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {/* AI Result */}
      {result && (
        <div className="vs-section">
          <div className="vs-section-heading">AI Result</div>
          <div className="vs-card" style={{ background: "#111", color: "#0f0", fontSize: 12 }}>
            <pre style={{ margin: 0, background: "none", color: "inherit", padding: 0, overflow: "auto" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="vs-section">
        <div className="vs-section-heading">Recent Requests</div>
        {logs.length === 0 && (
          <div className="vs-card" style={{ fontSize: 13, color: "var(--muted-text)", fontStyle: "italic" }}>No requests yet.</div>
        )}
        {logs.map((log) => (
          <div className="vs-card" key={log.id} style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 500 }}>{log.title}</div>
            <div>Transcript Length: {log.transcriptLength}</div>
            <div>Processing Time: {log.durationMs} ms</div>
            <div>Time: {new Date(log.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function loadStats() {
  const res = await fetch("/api/stats", { cache: "no-store" });
  return await res.json();
}