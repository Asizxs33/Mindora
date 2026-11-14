import { restorePlan } from './learning-plan.js';

export const BROWSER_GUEST = 'browser-guest';

// Guest courses live only in the existing browser workspace. The account API
// and its ownership/revision checks remain the network port for signed-in users.
export function createGuestCourseRequest({ read, write, active, createId = () => crypto.randomUUID() }) {
  function records() {
    const value = read();
    return Array.isArray(value) ? value.filter(course => typeof course?.id === 'string'
      && Number.isInteger(course.revision) && course.revision > 0 && restorePlan(course.saved)) : [];
  }
  function remember(course) {
    if (!active()) return false;
    const saved = restorePlan(course?.saved);
    if (!saved || !course.id) return false;
    const previous = records();
    if (!previous.some(item => item.id === course.id) && previous.length >= 40) {
      throw new Error('This browser already has 40 saved lessons.');
    }
    write([{ ...course, saved }, ...previous.filter(item => item.id !== course.id)]);
    return true;
  }
  async function request(path, method = 'GET', body) {
    if (!active()) throw new Error('The learning session changed.');
    const courses = records();
    const id = new URL(path, 'https://mindora.local').searchParams.get('id') || body?.id;
    if (method === 'GET') {
      if (id) {
        const course = courses.find(item => item.id === id);
        if (!course) throw new Error('The saved lesson could not be found on this device.');
        return { course: structuredClone(course) };
      }
      return { courses: courses.map(course => ({
        id: course.id, title: course.saved.plan.title, goal: course.saved.plan.goal,
        language: course.saved.plan.language, minutes: course.saved.plan.minutes,
        completed: course.saved.completed, totalSteps: course.saved.plan.steps.length,
        revision: course.revision, updatedAt: course.updatedAt,
      })) };
    }
    if (method === 'PUT') {
      const previous = courses.find(item => item.id === id);
      if (!previous || previous.revision !== body.revision) {
        throw Object.assign(new Error('This lesson changed in another tab.'), { status: 409 });
      }
      const course = { ...previous, saved: body.saved, revision: previous.revision + 1, updatedAt: new Date().toISOString() };
      if (!remember(course)) throw new Error('The lesson could not be saved.');
      return { course };
    }
    if (method === 'POST') {
      const course = { id: createId(), saved: body.saved, revision: 1, updatedAt: new Date().toISOString() };
      if (!remember(course)) throw new Error('The lesson could not be saved.');
      return { course };
    }
    throw new Error('Unsupported browser course action.');
  }
  return Object.assign(request, { remember });
}
