// src/extractor/vidnest.js
import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (compatible; VidnestFetcher/1.0)";

/**
 * Fetch the vidnest page and extract playable stream URLs.
 * Returns array of { url, title? }
 */
async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    timeout: 10000,
  });
  return data;
}

export async function fetchVidnestHindiStreams(anilistId, episodeNumber) {
  if (!anilistId || !episodeNumber) return [];
  const url = `https://vidnest.fun/anime/${encodeURIComponent(String(anilistId))}/${encodeURIComponent(String(episodeNumber))}/hindi`;

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const streams = [];

    // 1) iframes
    $("iframe").each((i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src) {
        const full = src.startsWith("http") ? src : new URL(src, url).href;
        streams.push({ url: full, title: "embed" });
      }
    });

    // 2) video > source
    $("video source").each((i, el) => {
      const src = $(el).attr("src");
      if (src) streams.push({ url: src.startsWith("http") ? src : new URL(src, url).href, title: "video" });
    });

    // 3) anchors to mp4/m3u8 etc
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      if (/\.(m3u8|mp4|mkv|mpd|m3u)(\?|$)/i.test(href) || href.includes("/stream/") || href.includes("drive.google.com")) {
        const full = href.startsWith("http") ? href : new URL(href, url).href;
        streams.push({ url: full, title: ($(el).text() || "link").trim() });
      }
    });

    // 4) scripts sniff (m3u8)
    const scriptText = $("script").map((_, s) => $(s).html()).get().join("\n");
    const m3u8s = (scriptText.match(/https?:\/\/[^'"\s]+\.m3u8[^'"\s]*/g) || []).filter(Boolean);
    m3u8s.forEach((u) => streams.push({ url: u, title: "m3u8" }));

    // dedupe and normalize absolute urls
    const seen = new Set();
    const out = [];
    for (const s of streams) {
      if (!s || !s.url) continue;
      const absolute = s.url.startsWith("http") ? s.url : new URL(s.url, url).href;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      out.push({ url: absolute, title: s.title || null });
    }

    // If nothing found return page url (frontend can embed it)
    if (!out.length) return [{ url, title: "vidnest-page" }];
    return out;
  } catch (err) {
    console.warn("fetchVidnestHindiStreams error:", err?.message || err);
    return [];
  }
}

export default { fetchVidnestHindiStreams };
