// src/controllers/streamController.js
import { validationError } from "../utils/errors.js";
import { getServers } from "./serversController.js";
import { extractStream } from "../extractor/extractStream.js";
import { slugToTitle, getAniListIdByTitle } from "../utils/anilist.js";
import { fetchVidnestHindiStreams } from "../extractor/vidnest.js";

/**
 * streamController
 * Query params:
 *  - id: episode id (must include ?ep=)
 *  - type: sub | dub | hindi | all  (default all)
 *  - server: optional server name to extract playable link
 */
const streamController = async (c) => {
  let { id, server = null, type = "all" } = c.req.query();

  if (!id) throw new validationError("id is required");
  if (!id.includes("ep=")) throw new validationError("episode id is not valid (expected ep=...)");

  type = String(type).toLowerCase();
  server = server ? String(server).toUpperCase() : null;

  // 1) gather sub/dub servers from existing helper (may throw)
  let servers = {};
  try {
    servers = (await getServers(id)) || {};
  } catch (err) {
    console.warn("getServers failed:", err?.message || err);
    servers = {};
  }

  // 2) attempt to fetch Vidnest Hindi (best-effort)
  const [animeSlug] = id.split("?");
  const epNum = id.includes("ep=") ? id.split("ep=").pop() : null;

  if (type === "hindi") {
    const titleGuess = slugToTitle(animeSlug);
    const alId = await getAniListIdByTitle(titleGuess);
    if (!alId) throw new validationError("AniList id not found for anime, cannot fetch vidnest");
    const streams = await fetchVidnestHindiStreams(alId, epNum);
    if (!streams || streams.length === 0) throw new validationError("Hindi dubbed stream not found");
    if (server) {
      const matched = streams.find((s) => (s.server || "").toUpperCase() === server || (s.title || "").toUpperCase() === server);
      if (matched) return { success: true, data: { server: server, streams: [matched] } };
    }
    return { success: true, data: { server: "VIDNEST-HINDI", streams } };
  }

  if (type === "all") {
    try {
      const titleGuess = slugToTitle(animeSlug);
      const alId = await getAniListIdByTitle(titleGuess);
      if (alId) servers.hindi = (await fetchVidnestHindiStreams(alId, epNum)) || [];
      else servers.hindi = [];
    } catch (e) {
      servers.hindi = [];
    }
    return { success: true, data: { servers } };
  }

  // type is sub/dub => require servers[type]
  if (!servers[type]) throw new validationError("Invalid type requested or no servers available for this type", { type });

  // If server provided, extract playable stream for that server
  if (server) {
    const selectedServer = servers[type].find((el) => {
      if (!el) return false;
      return (el.name || "").toUpperCase() === server || (el.server || "").toUpperCase() === server;
    });
    if (!selectedServer) throw new validationError("Server not found", { server });
    const response = await extractStream({ selectedServer, id });
    return { success: true, data: { server: selectedServer.name || server, streams: response } };
  }

  // otherwise return list of servers for the requested type
  return { success: true, data: { servers: { [type]: servers[type] } } };
};

export default streamController;
