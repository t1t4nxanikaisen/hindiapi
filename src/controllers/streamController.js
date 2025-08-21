// src/controllers/streamController.js
import { validationError } from "../utils/errors.js";
import { getServers } from "./serversController.js";
import { extractStream } from "../extractor/extractStream.js";
import anilistUtils from "../utils/anilist.js";
import vidnest from "../extractor/vidnest.js";

const { slugToTitle, getAniListIdByTitle } = anilistUtils;
const { fetchVidnestHindiStreams } = vidnest;

const streamController = async (c) => {
  let { id, server = null, type = "all" } = c.req.query();

  if (!id) throw new validationError("id is required");
  if (!id.includes("ep=")) throw new validationError("episode id is not valid (expected ep=...)");

  type = String(type).toLowerCase();
  server = server ? String(server).toUpperCase() : null;

  // gather sub/dub servers
  let servers = {};
  try {
    servers = (await getServers(id)) || {};
  } catch (err) {
    console.warn("getServers failed:", err?.message || err);
    servers = {};
  }

  // Prepare vidnest/hindi list when needed
  const [animeSlug] = id.split("?");
  const epNum = id.includes("ep=") ? id.split("ep=").pop() : null;

  if (type === "hindi") {
    const titleGuess = slugToTitle(animeSlug);
    const alId = await getAniListIdByTitle(titleGuess);
    if (!alId) throw new validationError("AniList id not found for anime, cannot fetch vidnest");
    const streams = await fetchVidnestHindiStreams(alId, epNum);
    if (!streams || streams.length === 0) throw new validationError("Hindi dubbed stream not found");
    if (server) {
      const matched = streams.find((s) => ((s.server || "") + "").toUpperCase() === server || ((s.title || "") + "").toUpperCase() === server);
      if (matched) return { success: true, data: { server: server, streams: [matched] } };
    }
    return { success: true, data: { server: "VIDNEST-HINDI", streams } };
  }

  if (type === "all") {
    // attach hindi non-fatal
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

  // type is sub or dub
  if (!servers[type]) throw new validationError("Invalid type requested or no servers available for this type", { type });

  // if server specified, extract playable
  if (server) {
    const selectedServer = servers[type].find((el) => {
      if (!el) return false;
      return (el.name || "").toUpperCase() === server || (el.server || "").toUpperCase() === server;
    });
    if (!selectedServer) throw new validationError("Server not found", { server });
    const response = await extractStream({ selectedServer, id });
    return { success: true, data: { server: selectedServer.name || server, streams: response } };
  }

  // otherwise return list for requested type
  return { success: true, data: { servers: { [type]: servers[type] } } };
};

export default streamController;
