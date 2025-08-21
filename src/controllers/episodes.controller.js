import axios from "axios";
import { validationError } from "../utils/errors.js";
import config from "../config/config.js";
import { extractEpisodes } from "../extractor/extractEpisodes.js";
import { slugToTitle, getAniListIdByTitle } from "../utils/anilist.js";
import { fetchVidnestHindiStreams } from "../extractor/vidnest.js";

const episodesController = async (c) => {
  const id = c.req.param("id");
  if (!id) throw new validationError("id is required");

  const idNum = id.split("-").at(-1);
  const htmlRes = await axios.get(`${config.baseurl}/ajax/v2/episode/list/${idNum}`, {
    headers: { Referer: `/watch/${id}`, ...config.headers },
  });
  const raw = extractEpisodes(htmlRes.data.html);
  const episodes = Array.isArray(raw) ? raw : [];

  const titleGuess = slugToTitle(id);
  const alId = await getAniListIdByTitle(titleGuess);

  const epList = await Promise.all(
    episodes.map(async (ep) => {
      const epNum = ep.episodeNumber || ep.episode || (ep.id.split("ep=").pop && Number(ep.id.split("ep=").pop()));
      const hindiStreams = alId ? await fetchVidnestHindiStreams(alId, epNum) : [];
      return {
        id: ep.id,
        episodeNumber: epNum,
        isFiller: Boolean(ep.isFiller),
        subStreams: [],
        dubStreams: [],
        hindiStreams,
      };
    })
  );

  return epList;
};

export default episodesController;
