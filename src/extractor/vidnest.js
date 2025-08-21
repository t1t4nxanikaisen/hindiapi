import axios from 'axios';
import cheerio from 'cheerio';
import config from '../config/config.js';

/**
 * Fetch stream URLs for a given anime episode in Hindi
 * @param {string} episodeId - e.g., "one-piece-100"
 * @returns {Promise<Object>} - { serverName: streamUrl, ... }
 */
export async function fetchVidnestHindiStreamByEpisode(episodeId) {
  try {
    const url = `${config.baseurl}/watch/${episodeId}`;
    const { data } = await axios.get(url, {
      headers: { ...config.headers, Referer: config.baseurl },
    });

    const $ = cheerio.load(data);
    const servers = {};

    // Example: parse all Hindi server links
    $('div.server-item').each((i, el) => {
      const serverName = $(el).attr('data-server-name');
      const streamUrl = $(el).attr('data-server-url');
      if (serverName && streamUrl) {
        servers[serverName.toUpperCase()] = streamUrl;
      }
    });

    if (Object.keys(servers).length === 0)
      throw new Error('No Hindi servers found for this episode');

    return servers;
  } catch (err) {
    console.error('VidNest Fetch Error:', err.message);
    throw new Error('Failed to fetch Hindi streams for this episode');
  }
}
