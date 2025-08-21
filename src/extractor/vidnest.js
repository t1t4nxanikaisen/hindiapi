import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetch all Hindi dubbed streams for an anime
 * @param {string} animeId
 * @param {number} episodeNumber
 */
export const fetchVidnestHindiStreams = async (animeId, episodeNumber) => {
  try {
    const url = `https://vidnest.com/api/hindi/${animeId}/episodes/${episodeNumber}`;
    const { data } = await axios.get(url);
    if (!data || !data.streams) return [];
    return data.streams.map((s) => ({
      server: s.server,
      url: s.url,
      quality: s.quality,
    }));
  } catch (err) {
    console.error('Vidnest fetchHindiStreams error:', err.message);
    return [];
  }
};

/**
 * Fetch a single Hindi dubbed stream by episode number
 * @param {number|string} episodeNumber
 */
export const fetchVidnestHindiStreamByEpisode = async (episodeNumber) => {
  try {
    const url = `https://vidnest.com/api/hindi/episode/${episodeNumber}`;
    const { data } = await axios.get(url);
    if (!data || !data.streams) return [];
    return data.streams.map((s) => ({
      server: s.server,
      url: s.url,
      quality: s.quality,
    }));
  } catch (err) {
    console.error('Vidnest fetchHindiStreamByEpisode error:', err.message);
    return [];
  }
};
