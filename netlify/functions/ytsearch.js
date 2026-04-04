// netlify/functions/ytsearch.js
// Primary: Invidious API (free, no key)
// Fallback: YouTube HTML scrape

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.privacyredirect.com",
  "https://yt.artemislena.eu",
];

export async function handler(event) {
  try {
    const { query } = JSON.parse(event.body);
    if (!query) return respond(400, { error: "No query" });

    // 1. Try Invidious instances
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(
          `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,lengthSeconds`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.[0]?.videoId) {
          return respond(200, {
            videoId: data[0].videoId,
            title:   data[0].title,
            duration: data[0].lengthSeconds,
            source: "invidious",
          });
        }
      } catch { continue; }
    }

    // 2. Fallback: YouTube HTML scrape
    const ytRes = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en-US,en;q=0.9" } }
    );
    const html = await ytRes.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match?.[1]) {
      return respond(200, { videoId: match[1], source: "scrape" });
    }

    return respond(404, { error: "Not found" });
  } catch (e) {
    return respond(500, { error: "Search failed" });
  }
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}
