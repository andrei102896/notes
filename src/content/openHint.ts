import { OPEN_HINT_SESSION_KEY } from "@/content/constants";

export function writeOpenHint(open: boolean): void {
  try {
    if (open) {
      window.sessionStorage.setItem(OPEN_HINT_SESSION_KEY, "1");
    } else {
      window.sessionStorage.removeItem(OPEN_HINT_SESSION_KEY);
    }
  } catch {
    // sessionStorage can throw (sandboxed/partitioned contexts, storage disabled).
  }
}

export function readOpenHint(): boolean {
  try {
    return window.sessionStorage.getItem(OPEN_HINT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
