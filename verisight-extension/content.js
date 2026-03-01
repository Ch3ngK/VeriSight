function getTitle() {
    // document.title often includes " - YouTube"
    const raw = document.title || "";
    return raw.replace(/\s*-\s*YouTube\s*$/i, "").trim();
}

function getTranscriptIfOpen() {
    // Transcript panel DOM can change over time; this is a best-effort MVP.
    // It works when the transcript panel is open and transcript segments exist.
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (!segments || segments.length === 0) return "";

    const lines = [];
    for (const seg of segments) {
        // Try to capture time + text if present
        const timeEl = seg.querySelector(".segment-timestamp");
        const textEl = seg.querySelector(".segment-text");

        const t = timeEl ? timeEl.textContent.trim() : "";
        const s = textEl ? textEl.textContent.trim() : seg.textContent.trim();

        if (s) lines.push(t ? `${t}  ${s}` : s);
    }
    return lines.join("\n");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "VERISIGHT_ANALYZE") return;

    const result = {
        url: location.href,
        title: getTitle(),
        transcript: getTranscriptIfOpen()
    };

    sendResponse(result);
    return true; // keep channel open if needed
});
