import { useEffect, useRef, useState, type RefObject } from "react";

import { getTabSession, patchTabSession } from "@/lib/tabSession";

/** Debounce a strip-scroll burst into one session write. */
const STRIP_SCROLL_SAVE_MS = 200;

/** Scroll the strip so the given trigger is fully in view (NN-10). */
function scrollTriggerFullyIntoView(
  container: HTMLDivElement,
  trigger: HTMLElement,
): void {
  const triggerTop = trigger.offsetTop;
  const triggerBottom = triggerTop + trigger.offsetHeight;
  const viewportTop = container.scrollTop;
  const viewportBottom = viewportTop + container.clientHeight;
  if (triggerTop < viewportTop) {
    container.scrollTo({ top: triggerTop, behavior: "smooth" });
  } else if (triggerBottom > viewportBottom) {
    container.scrollTo({
      top: triggerBottom - container.clientHeight,
      behavior: "smooth",
    });
  }
}

/** Persists strip scroll and RESTORES it on a cross-navigation reopen (PERSISTENCE) so the selected tab stays
 * put; genuine post-mount selection changes (e.g. an off-screen new tab) still reveal the active tab. */
export function useSubjectTabStripScroll({
  scrollRef,
  activeSubjectTabId,
  tabCount,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  activeSubjectTabId: string | null;
  tabCount: number;
}): { onScroll: () => void } {
  // Saved offset read once on mount (undefined = reading, null = none saved).
  const [savedScrollTop, setSavedScrollTop] = useState<
    number | null | undefined
  >(undefined);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Active tab the strip has already positioned for; "unset" until the first (mount) pass.
  const positionedForRef = useRef<string | null | "unset">("unset");

  useEffect(() => {
    let cancelled = false;
    void getTabSession().then((session) => {
      if (cancelled) {
        return;
      }
      const saved = session?.subjectTabScrollTop;
      setSavedScrollTop(typeof saved === "number" ? saved : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // First (mount) pass restores the saved scroll and must NOT reveal; later genuine selection changes
  // reveal the active tab. The ref makes StrictMode's re-invoke and the async id hydration no-op.
  useEffect(() => {
    if (savedScrollTop === undefined || tabCount === 0) {
      return;
    }
    const root = scrollRef.current;
    if (root === null || positionedForRef.current === activeSubjectTabId) {
      return;
    }
    const isInitial = positionedForRef.current === "unset";
    positionedForRef.current = activeSubjectTabId;

    if (isInitial) {
      if (savedScrollTop !== null) {
        root.scrollTop = savedScrollTop;
      }
      return;
    }
    if (activeSubjectTabId === null) {
      return;
    }
    const target = root.querySelector<HTMLElement>(
      '[data-slot="tabs-trigger"][data-state="active"]',
    );
    if (target !== null) {
      scrollTriggerFullyIntoView(root, target);
    }
  }, [scrollRef, activeSubjectTabId, savedScrollTop, tabCount]);

  useEffect(
    () => () => {
      if (scrollSaveTimerRef.current !== null) {
        clearTimeout(scrollSaveTimerRef.current);
      }
    },
    [],
  );

  // Debounced so a strip-scroll burst sends one patch; restored on a cross-navigation reopen.
  function onScroll(): void {
    const el = scrollRef.current;
    if (el === null) {
      return;
    }
    const top = el.scrollTop;
    if (scrollSaveTimerRef.current !== null) {
      clearTimeout(scrollSaveTimerRef.current);
    }
    scrollSaveTimerRef.current = setTimeout(() => {
      patchTabSession({ subjectTabScrollTop: top });
      scrollSaveTimerRef.current = null;
    }, STRIP_SCROLL_SAVE_MS);
  }

  return { onScroll };
}
