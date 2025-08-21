import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (compatible; Vidnest/1.0)";

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 10000,
  });
  return data;
}

export async function fetchVidnestHindiStreams(anilistId, epNum) {
  if (!anilistId || !epNum) return [];
  const url = `https://vidnest.fun/anime/${anilistId}/${epNum}/hindi`;
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const streams = [];

    $('iframe').each((_, el) => {
      const src = $(el).attr("src");
      if (src) streams.push({ url: src });
    });

    $('video source').each((_, el) => {
      const src = $(el).attr("src");
      if (src) streams.push({ url: src });
    });

    $('a[href]').each((_, el) => {
      const href = $(el).attr("href");
      if (href?.match(/\.(m3u8|mp4)\b/)) streams.push({ url: href });
    });

    const scriptText = $('script')
      .toArray()
      .map((s) => $(s).html())
      .join("\n");
    const m3u8s = [...new Set((scriptText.match(/https?:\/\/\S+\.m3u8/g) || []))];
    m3u8s.forEach((u) => streams.push({ url: u }));

    return streams.filter((s, i, arr) => s.url && arr.findIndex(x => x.url === s.url) === i);
  } catch (e) {
    console.warn("Vidnest fetch error:", e.message);
    return [];
  }
}
