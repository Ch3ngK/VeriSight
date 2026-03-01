type LogEntry = {
  id: string;
  title: string;
  transcriptLength: number;
  timestamp: number;
  durationMs: number;
  recommendedAction: "ignore" | "monitor" | "verify" | "escalate";
  isCrisis: boolean;
  crisisCategory: string;
  highSeveritySignals: number;
};

const logs: LogEntry[] = [];

export function addLog(entry: LogEntry) {
  logs.unshift(entry); // newest first
  if (logs.length > 20) logs.pop(); // keep last 20
}

export function getLogs() {
  return logs;
}