import { useSyncExternalStore } from "react";

const TICK_CHECK_MS = 15_000;
const MINUTE_MS = 60_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_CHECK_MS);
  return () => clearInterval(id);
}

// Rounded down to the minute so the snapshot stays referentially stable
// between checks (useSyncExternalStore requires that) and only changes when
// the displayed minute actually does.
function getSnapshot() {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

// null on the server and during hydration: anything derived from "now" or the
// browser's locale/timezone would otherwise render differently on the server
// and fail hydration, so such text is simply withheld until the client takes
// over.
function getServerSnapshot(): number | null {
  return null;
}

export function useMinuteTick(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
