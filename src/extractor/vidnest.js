import axios from 'axios';

/**
 * Fetches Hindi dubbed stream URLs from Vidnest.
 * @param {string} animeId - The AniList ID of the anime.
 * @param {number} episodeNumber - The episode number.
 * @returns {Promise<string[]>} - A list of Hindi dubbed stream URLs.
 */
export const fetchVidnestHindiStreams = async (animeId, episodeNumber) => {
  try {
    const response = await axios.get(`https://vidnest.fun/animepahe/${animeId}/${episodeNumber}/hindi`);
    // Extract and return the Hindi stream URLs from the response
    // This will depend on the structure of the Vidnest response
    return response.data.streamUrls; // Adjust according to actual response structure
  } catch (error) {
    console.error('Error fetching Vidnest Hindi streams:', error);
    return [];
  }
};
