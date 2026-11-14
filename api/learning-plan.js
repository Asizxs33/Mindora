import { planApi } from '../backend/plan-api.js';

export const maxDuration = 60;
export default { fetch: request => planApi(request) };
