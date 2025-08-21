import axios from 'axios';
import { validationError } from '../utils/errors.js';
import config from '../config/config.js';
import { extractEpisodes } from '../extractor/extractEpisodes.js';
import { fetchVidnestHindiStreams } from '../extractor/vidnest.js';

/**
 * Episodes Controller
 * Fetches all episode info (sub, dub, and Hindi dubbed) for an anime.
 */
const episodesController = async (c) => {
  const id = c.req.param('id');
  if (!id) throw new validationError('id is required');

  const Referer = `/watch/${id}`;
  const idNum = id.split('-').at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;

  try {
    // 1️⃣ Fetch sub/dub episodes from the site
    const { data } = await axios.get(config.baseurl + ajaxUrl, {
      headers: {
        Referer,
        ...config.headers,
      },
    });

    const episodes = extractEpisodes(data.html);

    // 2️⃣ Fetch Hindi dubbed streams from Vidnest
    const hindiStreamsPromises = episodes.map((ep) =>
      fetchVidnestHindiStreams(idNum, ep.episodeNumber)
    );

    const hindiStreamsResults = await Promise.all(hindiStreamsPromises);

    // 3️⃣ Attach Hindi streams to each episode
    const enrichedEpisodes = episodes.map((ep, index) => ({
      ...ep,
      hindiStreams: hindiStreamsResults[index] || [],
    }));

    return enrichedEpisodes;
  } catch (err) {
    console.error(err.message);
    throw new validationError('Make sure the id is correct', {
      validIdEX: 'one-piece-100',
    });
  }
};

export default episodesController;
