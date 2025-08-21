import { validationError } from '../utils/errors.js';
import { getServers } from './serversController.js';
import { extractStream } from '../extractor/extractStream.js';
import { fetchVidnestHindiStreamByEpisode } from '../extractor/vidnest.js';

/**
 * Stream Controller
 * Fetches the streaming links for a specific episode
 * Supports sub, dub, and Hindi dubbed (from Vidnest)
 */
const streamController = async (c) => {
  let { id, server = 'HD-1', type = 'sub' } = c.req.query();

  if (!id) throw new validationError('id is required');

  type = type.toLowerCase();
  server = server.toUpperCase();

  if (!id.includes('ep=')) throw new validationError('episode id is not valid');

  const servers = await getServers(id);

  if (type === 'hindi') {
    const episodeNum = id.split('ep=').pop();
    const hindiStreams = await fetchVidnestHindiStreamByEpisode(episodeNum);
    if (!hindiStreams || hindiStreams.length === 0)
      throw new validationError('Hindi dubbed stream not found');
    return { server: 'Vidnest Hindi', type: 'hindi', streams: hindiStreams };
  }

  if (!servers[type]) throw new validationError('Invalid type requested', { type });

  const selectedServer = servers[type].find((el) => el.name === server);
  if (!selectedServer)
    throw new validationError('Invalid server or server not found', { server });

  const response = await extractStream({ selectedServer, id });
  return response;
};

export default streamController;
