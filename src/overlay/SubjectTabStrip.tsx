import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SUBJECT_TAB_DEFAULT_SPAN,
  useSubjectTabCellSpans,
} from "@/hooks/useSubjectTabCellSpans";
import { useSubjectTabStripScroll } from "@/hooks/useSubjectTabStripScroll";
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
};

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
  const cellSpans = useSubjectTabCellSpans(
    sortedTabs.map((t) => t.name),
    tabsScrollAreaRef,
  );
  const { onScroll: handleStripScroll } = useSubjectTabStripScroll({
    scrollRef: tabsScrollAreaRef,
    activeSubjectTabId,
    tabCount: sortedTabs.length,
  });

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
        {/* Fills the cell so its own border is the only white; shrinking it to a square leaves slivers that
            break that, whatever they are painted. Glyph is capped instead — see styles.css. */}
        <div className="flex h-[var(--air-cell-snapped,var(--air-cell))] w-full shrink-0 items-center justify-center">
          <AddSubjectTabButton
            onClick={() => onAddDialogOpenChange(true)}
            disabled={isReadOnly}
            addDialogOpen={addDialogOpen}
            /* 1px white line on the right (outer shadow = no layout impact): the A–Z cell's own white
               border-r hugs the button's left border, so without this the white reads 5px left vs 4px right. */
            className="h-full w-full shadow-[1px_0_0_0_#ffffff]"
          />
        </div>

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
            onScroll={handleStripScroll}
            /* relative: be the offsetParent so triggers' offsetTop is container-relative for scrollToFirstLetter and the active-tab reveal effect. No CSS scroll-snap: Chrome's snap blocks the mouse wheel (it fights discrete notches → freezes after the first notch) and mouse-vs-trackpad can't be reliably detected — so per the client's "smooth first, snapping second" we drop snapping for free, smooth native scrolling on both devices. */
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
                  /* width === height: rotation is a transform, so the column stacks by the UNROTATED
                     height while the visible length is the width. pt centres the label on the strip. */
                  style={{
                    width: `calc(var(--air-cell) * ${cellSpans[tab.name] ?? SUBJECT_TAB_DEFAULT_SPAN})`,
                    height: `calc(var(--air-cell) * ${cellSpans[tab.name] ?? SUBJECT_TAB_DEFAULT_SPAN})`,
                  }}
                  className="shrink-0 justify-start leading-tight px-[1ch] pt-[0.3125rem] rotate-90 translate-x-[2.5rem] origin-top-left"
                >
                  {/* Case as typed: the client requires upper and lower case names (A–Z index matching and sorting are case-insensitive). */}
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>
    </>
  );
});
