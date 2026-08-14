import { useEffect, useState } from "react";

const PREFIX = "brotato-optimizer:";

function readStored(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw != null ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // private browsing / storage disabled - persistence just won't work
  }
}

// Like useState, but the initial value is read from localStorage (falling
// back to `initial` if there's nothing stored yet), and every update is
// written back - so state survives the page reload mobile browsers do when
// they reclaim a backgrounded/locked tab.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    const stored = readStored(key);
    return stored !== undefined ? stored : initial;
  });

  useEffect(() => {
    if (value != null) writeStored(key, value);
  }, [key, value]);

  return [value, setValue];
}
