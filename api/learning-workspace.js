import { learningWorkspaceApi } from '../backend/learning-workspace-api.js';

export default { fetch: request => learningWorkspaceApi(request) };
