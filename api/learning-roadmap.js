import { roadmapApi } from '../backend/roadmap-api.js';

export const maxDuration = 40;
export default { fetch: request => roadmapApi(request) };
