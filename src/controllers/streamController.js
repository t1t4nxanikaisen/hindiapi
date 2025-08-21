import { validationError } from "../utils/errors.js";
import { getServers } from "./serversController.js";
import { extractStream } from "../extractor/extractStream.js";
import { slugToTitle, getAniListIdByTitle } from "../utils/anilist.js";
import { fetchVidnestHindiStreams } from "../extractor/vidnest.js";

const streamController = async (c) => {
  const { id, type = "all", server = null } = c.req.query();
  if (!id) throw new validationError("id is required");
  if (!id.includes("ep=")) throw new validationError("invalid episode id");

  const servers = await getServers(id).catch(() => ({}));

  const [slug] = id.split("?");
  const epNum = id.split("ep=").pop();
  const alId = await getAniListIdByTitle(slug);

  if (type === "all") {
    const hindi = alId ? await fetchVidnestHindiStreams(alId, epNum) : [];
    servers.hindi = hindi;
    return { success: true, data: { servers } };
  }

  if (type === "hindi") {
    if (!alId) throw new validationError("AniList ID not found for Hindi lookup");
    const hindi = await fetchVidnestHindiStreams(alId, epNum);
    if (!hindi.length) throw new validationError("Hindi stream not found");
    return { success: true, data: { server: "VIDNEST", streams: hindi } };
  }

  // default SUB/DUB behavior
  if (!servers[type]) throw new validationError("Invalid type");
  if (server) {
    const sel = servers[type].find(s => (s.name || s.server).toUpperCase() === server.toUpperCase());
    if (!sel) throw new validationError("Server not found");
    const resp = await extractStream({ selectedServer: sel, id });
    return { success: true, data: { server: sel.name, streams: resp } };
  }
  return { success: true, data: { servers: { [type]: servers[type] } } };
};

export default streamController;
