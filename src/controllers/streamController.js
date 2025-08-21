import axios from "axios";
import { validationError } from "../utils/errors.js";
import { getServers } from "./serversController.js";
import { extractStream } from "../extractor/extractStream.js";

const HINDI_API_BASE = process.env.HINDI_API_BASE || "https://hindiapi.onrender.com/api/v1";

/**
 * Helper - fetch Hindi streams for one animeId and episodeNumber from Hindi API.
 * Returns normalized array: [{ url, server?, quality? }, ...]
 */
async function fetchHindiForEpisode(animeId, episodeNumber) {
  try {
    const url = `${HINDI_API_BASE}/episodes/${encodeURIComponent(animeId)}`;
    const res = await axios.get(url);
    const payload = res?.data ?? res;
    const eps =
      Array.isArray(payload?.episodes) && payload.episodes.length
        ? payload.episodes
        : Array.isArray(payload?.data) && payload.data.length
        ? payload.data
        : Array.isArray(payload) && payload.length
        ? payload
        : [];

    // find matching episode by number
    const match = eps.find((e) => {
      const num = e?.episodeNumber ?? e?.episode ?? (typeof e?.id === "string" && e.id.includes("ep=") ? Number(e.id.split("ep=").pop()) : null);
      return String(num) === String(episodeNumber);
    });

    if (!match) return [];

    const streams = match?.hindiStreams ?? match?.hindi ?? match?.streams ?? match?.sources ?? [];
    // normalize
    const norm = Array.isArray(streams)
      ? streams.map((s) => {
          if (!s) return null;
          if (typeof s === "string") return { url: s };
          if (s.url) return s;
          const firstUrl = Object.values(s).find((v) => typeof v === "string" && v.startsWith("http"));
          return firstUrl ? { url: firstUrl } : null;
        }).filter(Boolean)
      : [];
    return norm;
  } catch (err) {
    console.warn("fetchHindiForEpisode error:", err.message || err);
    return [];
  }
}

/**
 * Stream Controller
 * - If `type` is specified (sub/dub/hindi) and `server` is specified, returns single server stream result (old behaviour)
 * - If no server is specified and `type=all` or not provided, returns combined list of servers:
 *   { sub: [...], dub: [...], hindi: [...] }
 */
const streamController = async (c) => {
  let { id, server = null, type = "all" } = c.req.query();

  if (!id) throw new validationError("id is required");

  // id is the episode id (e.g., "one-piece-100?ep=12" or similar)
  if (!id.includes("ep=")) {
    throw new validationError("episode id is not valid (expected ep=...)");
  }

  type = String(type).toLowerCase();
  server = server ? String(server).toUpperCase() : null;

  // 1) gather existing servers (sub/dub) from getServers helper
  let serversObj = {};
  try {
    // getServers expected to return an object like { sub: [{name,url,...}], dub: [...] }
    serversObj = (await getServers(id)) || {};
  } catch (err) {
    console.warn("getServers failed:", err?.message || err);
    serversObj = {};
  }

  // 2) fetch Hindi streams for this anime/episode
  // we need the animeId (slug) and episodeNumber. Try to recover animeId from id param.
  // common id shapes: "<slug>?ep=12" or "<slug>-123?ep=12" — we will keep the full slug before '?'
  const [animeSlug] = id.split("?");
  const epNum = id.includes("ep=") ? id.split("ep=").pop() : null;

  const hindiStreams = await fetchHindiForEpisode(animeSlug, epNum);

  // Attach hindi as a server list
  serversObj.hindi = hindiStreams; // array (may be [])

  // If the caller asked for type=all (default), return the list of servers (do not extract playable streams)
  if (type === "all") {
    return {
      success: true,
      data: {
        servers: serversObj,
      },
    };
  }

  // If a specific language was requested: sub / dub / hindi
  if (type === "hindi") {
    if (!hindiStreams || hindiStreams.length === 0) {
      throw new validationError("Hindi dubbed stream not found");
    }
    // If server param specified and matches one of hindi server identifiers, try to return only that url
    if (server) {
      // try to match by name (if server names provided in the hindi items)
      const matched = hindiStreams.find((s) => (s.server || "").toUpperCase() === server || (s.name || "").toUpperCase() === server);
      if (matched) return { success: true, data: { server: server, streams: [matched] } };
      // else return all
    }
    return { success: true, data: { server: "VIDNEST-HINDI", streams: hindiStreams } };
  }

  // For sub/dub specific type: return the servers array for that type, or error if missing
  if (!serversObj[type]) {
    throw new validationError("Invalid type requested or no servers available for this type", { type });
  }

  // If a server name was requested (older behavior), find it and extract stream
  if (server) {
    const selectedServer = serversObj[type].find((el) => {
      if (!el) return false;
      return (el.name || "").toUpperCase() === server || (el.server || "").toUpperCase() === server;
    });
    if (!selectedServer) throw new validationError("Server not found", { server });
    // use existing extractor to get playable stream from selectedServer
    const response = await extractStream({ selectedServer, id });
    return { success: true, data: { server: selectedServer.name || server, streams: response } };
  }

  // Otherwise return the list of servers for the requested type (client can pick one)
  return { success: true, data: { servers: { [type]: serversObj[type] } } };
};

export default streamController;
