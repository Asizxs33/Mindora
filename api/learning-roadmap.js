import { roadmapApi } from '../backend/roadmap-api.js';

export const maxDuration = 60;
export default { fetch: request => roadmapApi(request) };
