import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { indexOfFirstTabForLetter, type AirLetter } from "@/lib/airSubjectTabs";
import { AddSubjectTabButton } from "@/overlay/AddSubjectTabButton";
import { SubjectTabAddDialog } from "@/overlay/SubjectTabAddDialog";
import { SubjectTabRenameDialog } from "@/overlay/SubjectTabRenameDialog";
import type { SubjectTabStripItem } from "@/types/nnData";

/** Defer deselect so a double-click can open rename instead (SUBJECT-TABS-2). */
const DESELECT_DEFER_MS = 200;

export type SubjectTabStripHandle = {
  /** Scroll (cue) to the first tab whose name starts with `letter` — no select (AIR-2). */
  scrollToFirstLetter: (letter: AirLetter) => void;
  /** Scroll the tab list so the tab with the given id is visible (NN-10). */
  scrollToTab: (id: string) => void;
};

/** Scroll the strip so the given trigger is fully in view (NN-10). */
function scrollTriggerFullyIntoView(
  container: HTMLDivElement,
  trigger: HTMLElement,
): boolean {
  const triggerTop = trigger.offsetTop;
  const triggerBottom = triggerTop + trigger.offsetHeight;
  const viewportTop = container.scrollTop;
  const viewportBottom = viewportTop + container.clientHeight;

  if (triggerTop < viewportTop) {
    container.scrollTo({ top: triggerTop, behavior: "smooth" });
    return true;
  }

  if (triggerBottom > viewportBottom) {
    container.scrollTo({
      top: triggerBottom - container.clientHeight,
      behavior: "smooth",
    });
    return true;
  }
  return false;
}

/** Pin a trigger to the TOP of the strip so a clicked A–Z letter's tabs "cue up" from the top (AIR-2); offsetTop is the pre-transform box so rotated triggers still align. Returns whether it actually scrolled. */
function scrollTriggerToTop(
  container: HTMLDivElement,
  trigger: HTMLElement,
): boolean {
  if (Math.abs(trigger.offsetTop - container.scrollTop) <= 1) {
    return false;
  }
  container.scrollTo({ top: trigger.offsetTop, behavior: "smooth" });
  return true;
}

type SubjectTabStripProps = {
  tabs: SubjectTabStripItem[];
  activeSubjectTabId: string | null;
  onSelectTab: (subjectTabId: string) => void;
  onCreateTab: (name: string) => void | Promise<void>;
  /** Add-tab dialog open state, lifted to the parent so the empty-state panel can hide while it's open. */
  addDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
  /** Select this tab without toggling off (e.g. SUBJECT-TABS-2 rename). */
  onEnsureActiveSubjectTab: (subjectTabId: string) => void | Promise<void>;
  onRenameSubjectTab: (
    subjectTabId: string,
    name: string,
  ) => void | Promise<void>;
  /** Trial-ended unpaid mode: disables tab creation/rename; selection still works to browse. */
  isReadOnly?: boolean;
};

/** Vertical subject tab column (SUBJECT-TABS-5): labels rotated 90° cw, built on shadcn Tabs (Radix); note list stays in {@link DashboardContent}. */
export const SubjectTabStrip = forwardRef<
  SubjectTabStripHandle,
  SubjectTabStripProps
>(function SubjectTabStrip(
  {
    tabs,
    activeSubjectTabId,
    onSelectTab,
    onCreateTab,
    addDialogOpen,
    onAddDialogOpenChange,
    onEnsureActiveSubjectTab,
    onRenameSubjectTab,
    isReadOnly = false,
  },
  ref,
) {
  const sortedTabs = [...tabs].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const [renameTarget, setRenameTarget] = useState<SubjectTabStripItem | null>(
    null,
  );

  const tabsScrollAreaRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollToFirstLetter(letter: AirLetter) {
        const idx = indexOfFirstTabForLetter(sortedTabs, letter);
        if (idx < 0) {
          return;
        }
        const root = tabsScrollAreaRef.current;
        if (root === null) {
          return;
        }
        const triggers = root.querySelectorAll<HTMLElement>(
          '[data-slot="tabs-trigger"]',
        );
        const target = triggers[idx];
        // Cue only: scroll the letter's first tab to the top WITHOUT selecting it (AIR-2).
        if (target !== undefined) {
          scrollTriggerToTop(root, target);
        }
      },
      scrollToTab(id: string) {
        const idx = sortedTabs.findIndex((t) => t.id === id);
        if (idx < 0) {
          return;
        }
        const root = tabsScrollAreaRef.current;
        if (root === null) {
          return;
        }
        const triggers = root.querySelectorAll<HTMLElement>(
          '[data-slot="tabs-trigger"]',
        );
        const target = triggers[idx];
        if (target !== undefined) {
          scrollTriggerFullyIntoView(root, target);
        }
      },
    }),
    [sortedTabs],
  );

  /** Same-tab deselect: Radix skips `onValueChange` when value unchanged; avoid `onClick` vs `onValueChange` ordering (first click was toggling off). */
  const pressStartedOnSelectedIdRef = useRef<string | null>(null);
  /** Deferred deselect so a double-click can open rename (SUBJECT-TABS-2) instead. */
  const pendingDeselectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function clearPendingDeselect(): void {
    if (pendingDeselectTimerRef.current !== null) {
      clearTimeout(pendingDeselectTimerRef.current);
      pendingDeselectTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearPendingDeselect();
    };
  }, []);

  useEffect(() => {
    clearPendingDeselect();
  }, [activeSubjectTabId]);

  return (
    <>
      <SubjectTabAddDialog
        open={addDialogOpen}
        onOpenChange={onAddDialogOpenChange}
        onConfirm={(name) => onCreateTab(name)}
      />

      <SubjectTabRenameDialog
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameTarget(null);
          }
        }}
        initialName={renameTarget?.name ?? ""}
        onConfirm={(name) => {
          const id = renameTarget?.id;
          if (id === undefined) {
            return;
          }
          return onRenameSubjectTab(id, name);
        }}
      />

      <div
        className="flex h-full w-10 shrink-0 flex-col"
        aria-label="Subject tabs"
      >
        <AddSubjectTabButton
          onClick={() => onAddDialogOpenChange(true)}
          disabled={isReadOnly}
          addDialogOpen={addDialogOpen}
        />

        <Tabs
          value={activeSubjectTabId ?? ""}
          orientation="vertical"
          className="flex min-h-0 min-w-10 flex-1 flex-col overflow-hidden"
          onValueChange={(next) => {
            if (next) {
              onSelectTab(next);
            }
          }}
        >
          <div
            ref={tabsScrollAreaRef}
            /* relative: be the offsetParent so triggers' offsetTop is container-relative for scrollToFirstLetter/scrollToTab. No CSS scroll-snap: Chrome's snap blocks the mouse wheel (it fights discrete notches → freezes after the first notch) and mouse-vs-trackpad can't be reliably detected — so per the client's "smooth first, snapping second" we drop snapping for free, smooth native scrolling on both devices. */
            className="relative mx-auto flex min-h-0 min-w-10 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-muted hidden-scrollbar"
          >
            <TabsList>
              {sortedTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  onPointerDown={(e) => {
                    if (e.button !== 0) {
                      return;
                    }
                    pressStartedOnSelectedIdRef.current =
                      activeSubjectTabId === tab.id ? tab.id : null;
                  }}
                  onClick={(e) => {
                    if (pressStartedOnSelectedIdRef.current === tab.id) {
                      pressStartedOnSelectedIdRef.current = null;
                      if (e.detail === 2) {
                        return;
                      }
                      clearPendingDeselect();
                      pendingDeselectTimerRef.current = setTimeout(() => {
                        pendingDeselectTimerRef.current = null;
                        onSelectTab(tab.id);
                      }, DESELECT_DEFER_MS);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    clearPendingDeselect();
                    onAddDialogOpenChange(false);
                    void onEnsureActiveSubjectTab(tab.id);
                    if (isReadOnly) {
                      return;
                    }
                    setRenameTarget(tab);
                  }}
                  /* first:border-l-0 clears the line above the first subject; -translate-y-px lifts the top-edge line by 1px onto the A–Z cell's bottom border. pl-2.5 indents the label start (~10px @ ref, post-rotation = gap at the cell top); pr-1 + tracking-tight keep max-length names from clipping where the renderer runs wide (Windows DirectWrite). */
                  className="w-[calc(var(--air-cell)*3)]! h-[calc(var(--air-cell)*3)]! shrink-0 justify-start leading-tight tracking-tight pl-2.5 pr-1 rotate-90 translate-x-[2.5rem] -translate-y-px origin-top-left first:border-l-0"
                >
                  {tab.name.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Bottom spacer (1 air-cell): scroll viewport = 24 cells (8×3) so the last tab aligns with the A–Z box rows. */}
        {/* <div
          aria-hidden
          className="nn-dashboard-content-frosted h-[var(--air-cell)] w-full shrink-0"
        /> */}
      </div>
    </>
  );
});
