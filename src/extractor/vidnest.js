// src/extractor/vidnest.js
import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (compatible; VidnestFetcher/1.0)";

/**
 * Fetch Vidnest page HTML
 */
async function fetchPageHtml(url) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    timeout: 10000,
  });
  return data;
}

/**
 * Extract potential playable links from vidnest page HTML
 * Return array of { url, title?, quality? }
 */
export async function fetchVidnestHindiStreams(anilistId, episodeNumber) {
  if (!anilistId || !episodeNumber) return [];
  const url = `https://vidnest.fun/anime/${encodeURIComponent(String(anilistId))}/${encodeURIComponent(String(episodeNumber))}/hindi`;
  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);
    const streams = [];

    // 1) iframes (common)
    $("iframe").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src) streams.push({ url: src, title: "embed" });
    });

    // 2) video > source
    $("video source").each((_, el) => {
      const src = $(el).attr("src");
      const type = $(el).attr("type") || null;
      if (src) streams.push({ url: src, title: type || "video" });
    });

    // 3) anchor links to .m3u8/.mp4 or known stream paths
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      if (/\.(m3u8|mp4|mkv|m3u|mpd)(\?|$)/i.test(href) || href.includes("/stream/") || href.includes("drive.google.com")) {
        streams.push({ url: href, title: ($(el).text() || "link").trim() });
      }
    });

    // 4) JS sniff for m3u8 in scripts
    const scripts = $("script")
      .map((_, s) => $(s).html())
      .get()
      .join("\n");
    const m3u8Matches = scripts.match(/https?:\/\/[^'"\s]+\.m3u8[^'"\s]*/g) || [];
    m3u8Matches.forEach((u) => streams.push({ url: u, title: "m3u8" }));

    // normalize and dedupe
    const unique = [];
    const seen = new Set();
    for (const s of streams) {
      if (!s?.url) continue;
      const absolute = s.url.startsWith("http") ? s.url : new URL(s.url, url).href;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      unique.push({ url: absolute, title: s.title ?? null });
    }

    // If no links found, return the page url as fallback (so frontend can embed it)
    if (!unique.length) return [{ url, title: "vidnest-page" }];

    return unique;
  } catch (err) {
    console.warn("fetchVidnestHindiStreams error:", err?.message || err);
    return [];
  }
}
