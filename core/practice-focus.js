export function practiceFocus(value) {
  return ['sheet-range', 'sheet-operation', 'python-output', 'assessment'].includes(value) ? value : null;
}

export function completedLessonFocus(saved) {
  return saved?.study?.map(entry => practiceFocus(entry?.practiceFocus)).findLast(Boolean) ?? null;
}
