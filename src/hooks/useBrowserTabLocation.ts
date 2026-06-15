import { useEffect, useState } from "react";

import { browsingContextWindowForTabUrl } from "@/lib/browsingContextWindow";
import { sessionUrlKey } from "@/lib/sessionUrlKey";

/**
 * Tracks the host page URL for the tab (same window as the overlay).
 * - `browserTabUrlKey` — normalized, for comparing to stored note URLs
 * - `browserTabHref` — raw `location.href` for display strings
 */
export function useBrowserTabLocation(): {
  browserTabUrlKey: string | null;
  browserTabHref: string;
} {
  const [browserTabUrlKey, setBrowserTabUrlKey] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionUrlKey(browsingContextWindowForTabUrl().location.href)
      : null,
  );
  const [browserTabHref, setBrowserTabHref] = useState<string>(() =>
    typeof window !== "undefined"
      ? browsingContextWindowForTabUrl().location.href
      : "",
  );

  useEffect(() => {
    const tabWin = browsingContextWindowForTabUrl();

    const sync = (): void => {
      const href = tabWin.location.href;
      setBrowserTabHref(href);
      setBrowserTabUrlKey(sessionUrlKey(href));
    };

    tabWin.addEventListener("popstate", sync);
    tabWin.addEventListener("hashchange", sync);

    const w = tabWin as Window & {
      navigation?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    };
    const nav = w.navigation;
    if (nav?.addEventListener) {
      nav.addEventListener("navigate", sync);
    }

    /** `pushState` does not fire `popstate`; poll catches most SPA URL changes. */
    const poll = window.setInterval(sync, 350);

    return () => {
      tabWin.removeEventListener("popstate", sync);
      tabWin.removeEventListener("hashchange", sync);
      nav?.removeEventListener?.("navigate", sync);
      window.clearInterval(poll);
    };
  }, []);

  return { browserTabUrlKey, browserTabHref };
}
