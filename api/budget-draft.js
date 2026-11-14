import { budgetDraftApi } from '../backend/cloud-api.js';

export default { fetch: request => budgetDraftApi(request) };
