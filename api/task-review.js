import { taskReviewApi } from '../backend/task-review-api.js';

export const maxDuration = 30;
export default { fetch: request => taskReviewApi(request) };
