// A tab owns only the snapshot it read or last wrote. Never replace a newer
// snapshot from another tab with this tab's entire in-memory workspace.
export function createWorkspaceStorage({ readValue, writeValue }) {
  let expected;
  let loaded = false;
  let conflicted = false;

  function hasConflict() {
    if (conflicted) return true;
    if (!loaded) throw new Error('Workspace storage could not be read.');
    if (readValue() !== expected) conflicted = true;
    return conflicted;
  }

  return {
    read() {
      expected = readValue();
      loaded = true;
      return expected;
    },
    write(serialized) {
      if (hasConflict()) return false;
      writeValue(serialized);
      expected = serialized;
      return true;
    },
    hasConflict,
    get conflicted() { return conflicted; },
  };
}
