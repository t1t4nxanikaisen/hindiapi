// src/controllers/episodes.controller.js
import axios from "axios";
import { validationError } from "../utils/errors.js";
import config from "../config/config.js";
import { extractEpisodes } from "../extractor/extractEpisodes.js";
import { slugToTitle, getAniListIdByTitle } from "../utils/anilist.js";
import { fetchVidnestHindiStreams } from "../extractor/vidnest.js";

/**
 * Episodes controller — returns normalized array of episodes with hindiStreams
 */
const episodesController = async (c) => {
  const id = c.req.param("id");
  if (!id) throw new validationError("id is required");

  const idNum = id.split("-").at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;
  try {
    const { data } = await axios.get(config.baseurl + ajaxUrl, {
      headers: { Referer: `/watch/${id}`, ...config.headers },
      timeout: 10000,
    });

    const raw = data?.html ? extractEpisodes(data.html) : data;
    const episodes = Array.isArray(raw) ? raw : [];

    // Find AniList ID from slug/title for Vidnest lookup (best-effort)
    const titleGuess = slugToTitle(id);
    const anilistId = await getAniListIdByTitle(titleGuess);

    // If there's an AniList ID, fetch Hindi streams per episode concurrently (throttled)
    const concurrency = 6;
    const results = [];
    const queue = episodes.map((ep) => ep); // copy

    async function worker() {
      while (queue.length) {
        const ep = queue.shift();
        const epNum =
          ep?.episodeNumber ??
          ep?.episode ??
          (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);
        let hindi = [];
        if (anilistId && epNum != null) {
          try {
            hindi = await fetchVidnestHindiStreams(anilistId, epNum);
          } catch (err) {
            hindi = [];
          }
        }
        results.push({ ep, hindi });
      }
    }

    // launch workers
    const workers = Array.from({ length: Math.min(concurrency, episodes.length) }, () => worker());
    await Promise.all(workers);

    // assemble normalized episodes, keep order by looking up episodeNumber
    const hindiMap = {};
    results.forEach((r) => {
      const num =
        r.ep?.episodeNumber ??
        r.ep?.episode ??
        (typeof r.ep?.id === "string" && r.ep.id.includes("ep=") ? Number(r.ep.id.split("ep=").pop()) : null);
      if (num != null) hindiMap[num] = r.hindi || [];
    });

    const normalized = episodes.map((ep) => {
      const epNum =
        ep?.episodeNumber ??
        ep?.episode ??
        (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);

      return {
        id: ep.id ?? `${id}?ep=${epNum ?? ""}`,
        episodeNumber: epNum,
        title: ep.title ?? ep.name ?? `Episode ${epNum ?? ""}`,
        isFiller: Boolean(ep.isFiller || ep?.filler),
        subStreams: ep.subStreams ?? ep.sources?.sub ?? ep.sub ?? [],
        dubStreams: ep.dubStreams ?? ep.sources?.dub ?? ep.dub ?? [],
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
