import { learningCoursesApi } from '../backend/learning-courses-api.js';

export default { fetch: request => learningCoursesApi(request) };
