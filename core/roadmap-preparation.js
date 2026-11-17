export async function requestLesson(input, headers, signal, fetcher = fetch) {
  const deadline = AbortSignal.timeout(57000);
  const response = await fetcher('/api/learning-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
    signal: signal ? AbortSignal.any([deadline, signal]) : deadline,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error || 'Lesson preparation failed.'), { status: response.status });
  if (!result) throw new SyntaxError('Invalid lesson response.');
  return result;
}

export function roadmapLessonInput(roadmap, index) {
  const { title, objective, kind } = roadmap.stages[index];
  const { goal, originalGoal, level, levelReason } = roadmap;
  const previousStages = [];
  for (let i = Math.max(0, index - 3); i < index; i++) {
    if (!roadmap.progress[i].completed) continue;
    const previous = roadmap.stages[i];
    previousStages.push({ title: previous.title, objective: previous.objective });
  }
  const reviewFocus = roadmap.progress[index - 1]?.reviewFocus;
  return {
    goal: `${title} — ${goal}`.slice(0, 180), minutes: roadmap.minutes, language: roadmap.language,
    roadmapStage: {
      goal, title, objective, level, levelReason, previousStages,
      ...(originalGoal ? { originalGoal } : {}), ...(kind ? { kind } : {}), ...(reviewFocus ? { reviewFocus } : {}),
    },
  };
}

export function readyPracticeForStage(roadmap, index) {
  const stage = roadmap.stages[index];
  const subject = `${roadmap.goal} ${roadmap.originalGoal || ''}`;
  const objective = `${stage.title} ${stage.objective}`;
  if (/\bsheets?\b|\bexcel\b|spreadsheet|таблиц|кесте/iu.test(subject)
    && /\branges?\b|\bsum\b|\bweekly (?:expenses?|report)\b|диапазон|сумм|шығын|ауқым/iu.test(objective)) return 'weekly-report';
  if (/\bpython\b|питон|пайтон/iu.test(subject)
    && /\bprint(?:ing)? (?:a|one|your first) (?:message|line|greeting)|print\s*\(|выведи сообщен|вывод.*сообщен|хабарламаны шығар/iu.test(objective)) return 'python-basics';
  if (/\bsql\b/iu.test(subject)
    && /\bselect (?:a|one|the) column|\bselect\s+.{1,30}\s+from\b|выб(?:ери|рать).*столбец|бағанды таңда/iu.test(objective)) return 'sql-tables';
  if (/\benglish\b|английск|ағылшын/iu.test(subject)
    && /introduce yourself|say hello|self.introduction|представить себя|самопредставлен|өзіңді таныстыр/iu.test(objective)) return 'everyday-english';
  return null;
}

// Opening a lesson can join preparation already started by completing the preceding one.
export function createStagePreparation() {
  const pending = new Map();
  return {
    get busy() { return pending.size > 0; },
    run(key, prepare) {
      if (pending.has(key)) return pending.get(key).result;
      const controller = new AbortController();
      const result = Promise.resolve().then(() => prepare(controller.signal)).finally(() => {
        if (pending.get(key)?.result === result) pending.delete(key);
      });
      pending.set(key, { controller, result });
      return result;
    },
    cancel() {
      for (const { controller } of pending.values()) controller.abort();
      pending.clear();
    },
  };
}
