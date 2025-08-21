import { validationError } from '../utils/errors.js';
import { getServers } from './serversController.js';
import { extractStream } from '../extractor/extractStream.js';

/**
 * Stream Controller
 * Fetches the streaming links for a specific episode
 * Supports sub and dub only (Hindi removed)
 */
const streamController = async (c) => {
  let { id, server = 'HD-1', type = 'sub' } = c.req.query();

  if (!id) throw new validationError('id is required');

  type = type.toLowerCase();
  server = server.toUpperCase();

  if (!id.includes('ep=')) throw new validationError('episode id is not valid');

  // Fetch all available servers
  const servers = await getServers(id);

  // Validate requested type
  if (!servers[type]) throw new validationError('Invalid type requested', { type });

  const selectedServer = servers[type].find((el) => el.name === server);
  if (!selectedServer)
    throw new validationError('Invalid server or server not found', { server });

  const response = await extractStream({ selectedServer, id });
  return response;
};

export default streamController;
