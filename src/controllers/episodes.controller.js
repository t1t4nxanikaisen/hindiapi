import axios from "axios";
import { validationError } from "../utils/errors.js";
import config from "../config/config.js";
import { extractEpisodes } from "../extractor/extractEpisodes.js";

/**
 * Fetch Hindi episodes map from external Hindi API
 * returns { [episodeNumber]: [ { url, server?, quality? }, ... ] }
 */
async function fetchHindiMap(animeId) {
  const base = process.env.HINDI_API_BASE || "https://hindiapi.onrender.com/api/v1";
  try {
    const url = `${base}/episodes/${encodeURIComponent(animeId)}`;
    const res = await axios.get(url, { timeout: 8000 });
    const payload = res?.data ?? res;
    const eps =
      Array.isArray(payload?.episodes) && payload.episodes.length
        ? payload.episodes
        : Array.isArray(payload?.data) && payload.data.length
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

    const map = {};
    for (const e of eps) {
      const num =
        e?.episodeNumber ??
        e?.episode ??
        (typeof e?.episodeNo === "number" ? e.episodeNo : null) ??
        (typeof e?.id === "string" && e.id.includes("ep=") ? Number(e.id.split("ep=").pop()) : null);
      if (!num) continue;
      const streams = e?.hindiStreams ?? e?.hindi ?? e?.streams ?? [];
      const norm = Array.isArray(streams)
        ? streams
            .map((s) => {
              if (!s) return null;
              if (typeof s === "string") return { url: s };
              if (s.url) return s;
              const firstUrl = Object.values(s).find((v) => typeof v === "string" && v.startsWith("http"));
              return firstUrl ? { url: firstUrl } : null;
            })
            .filter(Boolean)
        : [];
      map[Number(num)] = norm;
    }
    return map;
  } catch (err) {
    console.warn("fetchHindiMap error:", err.message || err);
    return {};
  }
}

const episodesController = async (c) => {
  const id = c.req.param("id");
  if (!id) throw new validationError("id is required");

  const Referer = `/watch/${id}`;
  const idNum = id.split("-").at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;

  try {
    const { data } = await axios.get(config.baseurl + ajaxUrl, {
      headers: { Referer, ...config.headers },
      timeout: 10000,
    });

    const raw = data?.html ? extractEpisodes(data.html) : data;
    const episodes = Array.isArray(raw) ? raw : [];

    const hindiMap = await fetchHindiMap(id);

    const normalized = episodes.map((ep) => {
      const epNum =
        ep?.episodeNumber ??
        ep?.episode ??
        (typeof ep?.episodeNo === "number" ? ep.episodeNo : null) ??
        (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);

      return {
        id: ep.id ?? `${id}?ep=${epNum ?? ""}`,
        episodeNumber: epNum,
        title: ep.title ?? ep.name ?? `Episode ${epNum ?? ""}`,
        isFiller: Boolean(ep.isFiller || ep.filler),
        subStreams: ep.subStreams ?? ep.sources?.sub ?? ep.sub ?? (ep.streams && ep.streams.sub) ?? [],
        dubStreams: ep.dubStreams ?? ep.sources?.dub ?? ep.dub ?? (ep.streams && ep.streams.dub) ?? [],
        hindiStreams: Array.isArray(hindiMap[Number(epNum)]) ? hindiMap[Number(epNum)] : [],
      };
    });

    return normalized;
  } catch (err) {
    console.error("episodesController error:", err?.message || err);
    throw new validationError("Make sure the id is correct", { validIdEX: "one-piece-100" });
  }
};

export default episodesController;
