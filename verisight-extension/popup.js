const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const urlEl = document.getElementById("url");
const transcriptEl = document.getElementById("transcript");

function setStatus(msg) {
    statusEl.textContent = msg || "";
}

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function isYouTubeWatchUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.includes("youtube.com") && u.pathname === "/watch";
    } catch {
        return false;
    }
}

analyzeBtn.addEventListener("click", async () => {
    analyzeBtn.disabled = true;
    setStatus("Analyzing…");

    try {
        const tab = await getActiveTab();
        if (!tab?.id || !tab.url) throw new Error("No active tab found.");

        if (!isYouTubeWatchUrl(tab.url)) {
            setStatus("Open a YouTube video page (/watch) first.");
            analyzeBtn.disabled = false;
            return;
        }

        const resp = await chrome.tabs.sendMessage(tab.id, { type: "VERISIGHT_ANALYZE" });

        titleEl.textContent = resp.title || "—";
        urlEl.textContent = resp.url || "—";

        if (resp.transcript && resp.transcript.trim().length > 0) {
            transcriptEl.textContent = resp.transcript.slice(0, 8000);
            setStatus(`Done. Transcript chars: ${resp.transcript.length}`);
        } else {
            transcriptEl.textContent = "—";
            setStatus("Done. No transcript found (open the transcript panel first).");
        }
    } catch (err) {
        setStatus(`Error: ${err.message || err}`);
    } finally {
        analyzeBtn.disabled = false;
    }
});
