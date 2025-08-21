import axios from "axios";
import { validationError } from "../utils/errors.js";
import config from "../config/config.js";
import { extractEpisodes } from "../extractor/extractEpisodes.js";

/**
 * Helper: fetch Hindi episodes map from your Hindi API.
 * Returns a map: { [episodeNumber]: [ { url, server?, quality? }, ... ] }
 */
async function fetchHindiMap(animeId) {
  const base = process.env.HINDI_API_BASE || "https://hindiapi.onrender.com/api/v1";
  try {
    const url = `${base}/episodes/${encodeURIComponent(animeId)}`;
    const res = await axios.get(url);
    const payload = res?.data ?? res;
    // Support different shapes: payload.data, payload.episodes, payload
    const eps =
      Array.isArray(payload?.episodes) && payload.episodes.length
        ? payload.episodes
        : Array.isArray(payload?.data) && payload.data.length
        ? payload.data
        : Array.isArray(payload) && payload.length
        ? payload
        : [];

    const map = {};
    for (const e of eps) {
      const num =
        e?.episodeNumber ??
        e?.episode ??
        (typeof e?.id === "string" && e.id.includes("ep=") ? Number(e.id.split("ep=").pop()) : null);
      if (!num) continue;
      // try common keys for stream arrays
      const streams = e?.hindiStreams ?? e?.hindi ?? e?.streams ?? e?.sources ?? [];
      // normalize to array of objects { url, server?, quality? }
      const norm = Array.isArray(streams)
        ? streams.map((s) => {
            if (!s) return null;
            if (typeof s === "string") return { url: s };
            if (typeof s === "object" && s.url) return s;
            // fallback try to pull url-like field
            const firstUrl = Object.values(s).find((v) => typeof v === "string" && v.startsWith("http"));
            return firstUrl ? { url: firstUrl } : null;
          }).filter(Boolean)
        : [];

      map[Number(num)] = norm;
    }

    return map;
  } catch (err) {
    console.warn("fetchHindiMap error:", err.message || err);
    return {};
  }
}

/**
 * Episodes Controller
 * Returns episodes array enriched with hindiStreams where available,
 * and basic sub/dub flags so frontend can show SUB/DUB/HINDI buttons.
 */
const episodesController = async (c) => {
  const id = c.req.param("id");
  if (!id) throw new validationError("id is required");

  const Referer = `/watch/${id}`;
  const idNum = id.split("-").at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;

  try {
    const { data } = await axios.get(config.baseurl + ajaxUrl, {
      headers: {
        Referer,
        ...config.headers,
      },
      timeout: 10000,
    });

    // extractEpisodes should return an array (but be defensive)
    const episodes = Array.isArray(data?.html ? extractEpisodes(data.html) : data)
      ? (data?.html ? extractEpisodes(data.html) : data)
      : [];

    // fetch hindi map (episodeNumber -> [streams])
    const hindiMap = await fetchHindiMap(id);

    // normalize episodes into the exact format frontend expects
    const normalized = episodes.map((ep) => {
      // determine episode number robustly
      const epNum =
        ep?.episodeNumber ??
        ep?.episode ??
        (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);

      return {
        // id should keep the existing id if present, otherwise construct one
        id: ep.id ?? `${id}?ep=${epNum ?? ""}`,
        episodeNumber: epNum,
        title: ep.title ?? ep.name ?? `Episode ${epNum ?? ""}`,
        isFiller: Boolean(ep.isFiller || ep?.filler),
        // let frontend know sub/dub availability (best-effort: many sites have both)
        subStreams: ep.subStreams ?? ep.sources?.sub ?? ep.sub ?? (ep.streams && ep.streams.sub) ?? [],
        dubStreams: ep.dubStreams ?? ep.sources?.dub ?? ep.dub ?? (ep.streams && ep.streams.dub) ?? [],
        // attach hindiStreams from hindiMap (may be [])
        hindiStreams: Array.isArray(hindiMap[Number(epNum)]) ? hindiMap[Number(epNum)] : [],
      };
    });

    // always return a consistent array
    return normalized;
  } catch (err) {
    console.error("episodesController error:", err?.message || err);
    throw new validationError("Make sure the id is correct", {
      validIdEX: "one-piece-100",
    });
  }
};

export default episodesController;
