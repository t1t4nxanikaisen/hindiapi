// src/controllers/episodes.controller.js
import axios from "axios";
import { validationError } from "../utils/errors.js";
import config from "../config/config.js";
import { extractEpisodes } from "../extractor/extractEpisodes.js";
import anilistUtils from "../utils/anilist.js";
import vidnest from "../extractor/vidnest.js";

const { slugToTitle, getAniListIdByTitle } = anilistUtils;
const { fetchVidnestHindiStreams } = vidnest;

const DEFAULT_CONCURRENCY = 6;

async function mapWithThrottle(items, workerFn, concurrency = DEFAULT_CONCURRENCY) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      try {
        results[i] = await workerFn(items[i], i);
      } catch (e) {
        results[i] = [];
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

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

    const rawEpisodes = data?.html ? extractEpisodes(data.html) : data;
    const episodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

    // attempt AniList id lookup
    const titleGuess = slugToTitle(id);
    const anilistId = await getAniListIdByTitle(titleGuess);

    // fetch hindi streams for each episode concurrently (throttled)
    const hindiResults = anilistId
      ? await mapWithThrottle(
          episodes,
          async (ep) => {
            const epNum = ep?.episodeNumber ?? ep?.episode ?? (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);
            if (!epNum) return [];
            return await fetchVidnestHindiStreams(anilistId, epNum);
          },
          DEFAULT_CONCURRENCY
        )
      : new Array(episodes.length).fill([]);

    // assemble normalized episodes
    const normalized = episodes.map((ep, idx) => {
      const epNum = ep?.episodeNumber ?? ep?.episode ?? (typeof ep?.id === "string" && ep.id.includes("ep=") ? Number(ep.id.split("ep=").pop()) : null);
      return {
        id: ep.id ?? `${id}?ep=${epNum ?? ""}`,
        episodeNumber: epNum,
        title: ep.title ?? ep.name ?? `Episode ${epNum ?? ""}`,
        isFiller: Boolean(ep.isFiller || ep?.filler),
        subStreams: ep.subStreams ?? ep.sources?.sub ?? ep.sub ?? (ep.streams && ep.streams.sub) ?? [],
        dubStreams: ep.dubStreams ?? ep.sources?.dub ?? ep.dub ?? (ep.streams && ep.streams.dub) ?? [],
        // attach vidnest results (safe default to [])
        hindiStreams: Array.isArray(hindiResults[idx]) ? hindiResults[idx] : [],
      };
    });

    return normalized;
  } catch (err) {
    console.error("episodesController error:", err?.message || err);
    throw new validationError("Make sure the id is correct", { validIdEX: "one-piece-100" });
  }
};

export default episodesController;
