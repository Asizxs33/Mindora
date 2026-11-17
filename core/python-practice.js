const OPERATIONS = {
  sum: values => values.reduce((total, value) => total + value, 0),
  count: values => values.length,
  min: values => Math.min(...values),
  max: values => Math.max(...values),
  double: values => values.map(value => value * 2).join('\n'),
};

export function normalizePythonChecks(raw) {
  if (!raw || typeof raw.operation !== 'string' || !Object.hasOwn(OPERATIONS, raw.operation)
    || !Array.isArray(raw.inputs) || raw.inputs.length !== 2) return null;
  const inputs = raw.inputs;
  if (!inputs.every(values => Array.isArray(values) && values.length >= 2 && values.length <= 6
    && values.every(value => Number.isInteger(value) && Math.abs(value) <= 1000))) return null;
  if (OPERATIONS[raw.operation](inputs[0]) === OPERATIONS[raw.operation](inputs[1])) return null;
  return { operation: raw.operation, inputs: inputs.map(values => [...values]) };
}

export function pythonPrograms(checks, code) {
  return checks.inputs.map(values => `values = ${JSON.stringify(values)}\n${code}`);
}

export function checkPythonCases(checks, results) {
  if (!Array.isArray(results) || results.length !== checks.inputs.length) return null;
  return checks.inputs.map((values, index) => {
    const result = results[index];
    return !result.error && result.output.trim() === String(OPERATIONS[checks.operation](values));
  });
}
