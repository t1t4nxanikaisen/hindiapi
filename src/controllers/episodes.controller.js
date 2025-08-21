import fetch from "node-fetch";

export const getEpisodeDetails = async (c) => {
  const { animeId } = c.req.param();

  try {
    // 1. Fetch episodes from Gogoanime (SUB + DUB)
    const res = await fetch(
      `https://api.consumet.org/anime/gogoanime/info/${animeId}`
    );
    const data = await res.json();

    if (!data?.episodes || !Array.isArray(data.episodes)) {
      return c.json({ episodes: [] }, 200);
    }

    // 2. Fetch Hindi Dub episodes from your Hindi API
    let hindiRes = [];
    try {
      const hr = await fetch(
        `https://hindiapi.onrender.com/api/v1/episodes/${animeId}`
      );
      hindiRes = await hr.json();
    } catch (err) {
      console.warn("Hindi API not available, skipping...");
    }

    // Make a quick lookup table for Hindi streams by episode number
    const hindiMap = {};
    if (hindiRes?.episodes) {
      hindiRes.episodes.forEach((ep) => {
        hindiMap[ep.episodeNumber] = ep.streams || [];
      });
    }

    // 3. Merge into unified format
    const episodes = data.episodes.map((ep) => ({
      id: `${animeId}?ep=${ep.number}`,
      episodeNumber: ep.number,
      isFiller: ep.isFiller ?? false,
      title: ep.title ?? `Episode ${ep.number}`,
      sub: true,
      dub: true,
      hindiStreams: hindiMap[ep.number] || [], // attach Hindi if available
    }));

    return c.json({ episodes }, 200);
  } catch (err) {
    console.error(err);
    return c.json({ episodes: [] }, 500);
  }
};
