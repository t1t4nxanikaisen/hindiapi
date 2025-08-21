import axios from "axios";
import { validationError } from "../utils/errors.js";
import { getServers } from "./serversController.js";
import { extractStream } from "../extractor/extractStream.js";

const HINDI_API_BASE = process.env.HINDI_API_BASE || "https://hindiapi.onrender.com/api/v1";

async function fetchHindiForEpisode(animeId, episodeNumber) {
  try {
    const url = `${HINDI_API_BASE}/episodes/${encodeURIComponent(animeId)}`;
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

    const match = eps.find((e) => {
      const num = e?.episodeNumber ?? e?.episode ?? (typeof e?.episodeNo === "number" ? e.episodeNo : null) ?? (typeof e?.id === "string" && e.id.includes("ep=") ? Number(e.id.split("ep=").pop()) : null);
      return String(num) === String(episodeNumber);
    });

    if (!match) return [];

    const streams = match?.hindiStreams ?? match?.hindi ?? match?.streams ?? [];
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
    return norm;
  } catch (err) {
    console.warn("fetchHindiForEpisode error:", err.message || err);
    return [];
  }
}

const streamController = async (c) => {
  let { id, server = null, type = "all" } = c.req.query();

  if (!id) throw new validationError("id is required");
  if (!id.includes("ep=")) throw new validationError("episode id is not valid (expected ep=...)");

  type = String(type).toLowerCase();
  server = server ? String(server).toUpperCase() : null;

  let serversObj = {};
  try {
    serversObj = (await getServers(id)) || {};
  } catch (err) {
    console.warn("getServers failed:", err?.message || err);
    serversObj = {};
  }

  const [animeSlug] = id.split("?");
  const epNum = id.includes("ep=") ? id.split("ep=").pop() : null;

  const hindiStreams = await fetchHindiForEpisode(animeSlug, epNum);

  // attach hindi as simple array
  serversObj.hindi = hindiStreams;

  // default: return all servers list for client to render
  if (type === "all") {
    return { success: true, data: { servers: serversObj } };
  }

  if (type === "hindi") {
    if (!hindiStreams || hindiStreams.length === 0) throw new validationError("Hindi dubbed stream not found");
    if (server) {
      const matched = hindiStreams.find((s) => (s.server || "").toUpperCase() === server || (s.name || "").toUpperCase() === server);
      if (matched) return { success: true, data: { server: server, streams: [matched] } };
    }
    return { success: true, data: { server: "VIDNEST-HINDI", streams: hindiStreams } };
  }

  // sub/dub handling
  if (!serversObj[type]) throw new validationError("Invalid type requested or no servers available for this type", { type });

  if (server) {
    const selectedServer = serversObj[type].find((el) => {
      if (!el) return false;
      return (el.name || "").toUpperCase() === server || (el.server || "").toUpperCase() === server;
    });
    if (!selectedServer) throw new validationError("Server not found", { server });
    const response = await extractStream({ selectedServer, id });
    return { success: true, data: { server: selectedServer.name || server, streams: response } };
  }

  return { success: true, data: { servers: { [type]: serversObj[type] } } };
};

export default streamController;
