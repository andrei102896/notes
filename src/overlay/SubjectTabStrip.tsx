import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { indexOfFirstTabForLetter, type AirLetter } from "@/lib/airSubjectTabs";
import { SubjectTabAddDialog } from "@/overlay/SubjectTabAddDialog";
import { SubjectTabRenameDialog } from "@/overlay/SubjectTabRenameDialog";
import type { SubjectTabStripItem } from "@/types/nnData";

/** Defer deselect so a double-click can open rename instead (SUBJECT-TABS-2). */
const DESELECT_DEFER_MS = 200;

export type SubjectTabStripHandle = {
  /** Select and scroll to the first tab whose name starts with `letter` (AIR-2). */
  scrollToFirstLetter: (letter: AirLetter) => void;
  /** Scroll the tab list so the tab with the given id is visible (NN-10). */
  scrollToTab: (id: string) => void;
};

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
    return;
  }

  if (triggerBottom > viewportBottom) {
    container.scrollTo({
      top: triggerBottom - container.clientHeight,
      behavior: "smooth",
    });
  }
}

type SubjectTabStripProps = {
  tabs: SubjectTabStripItem[];
  activeSubjectTabId: string | null;
  onSelectTab: (subjectTabId: string) => void;
  onCreateTab: (name: string) => void | Promise<void>;
  /** Select this tab without toggling off (e.g. SUBJECT-TABS-2 rename). */
  onEnsureActiveSubjectTab: (subjectTabId: string) => void | Promise<void>;
  onRenameSubjectTab: (
    subjectTabId: string,
    name: string,
  ) => void | Promise<void>;
  /**
   * Trial-ended unpaid mode: disables tab creation and rename. Tab selection
   * still works so the user can browse existing subjects.
   */
  isReadOnly?: boolean;
};

/**
 * Vertical subject tab column: fixed width, uppercase labels rotated 90° clockwise,
 * bright blue active state, dark inactive panels, white hairline borders (SUBJECT-TABS-5).
 * Built on shadcn Tabs (Radix) for triggers + semantics; note list stays in {@link DashboardContent}.
 */
export const SubjectTabStrip = forwardRef<
  SubjectTabStripHandle,
  SubjectTabStripProps
>(function SubjectTabStrip(
  {
    tabs,
    activeSubjectTabId,
    onSelectTab,
    onCreateTab,
    onEnsureActiveSubjectTab,
    onRenameSubjectTab,
    isReadOnly = false,
  },
  ref,
) {
  const sortedTabs = [...tabs].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const [addDialogOpen, setAddDialogOpen] = useState(false);

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
        const id = sortedTabs[idx]?.id;
        if (id === undefined) {
          return;
        }
        void onEnsureActiveSubjectTab(id);
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
    [sortedTabs, onEnsureActiveSubjectTab],
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
        onOpenChange={setAddDialogOpen}
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
        <Button
          variant="icon"
          size="icon"
          /* One A–Z cell tall (var(--air-cell)) — top-aligned with letter A. */
          className="relative z-30 h-[var(--air-cell)] shrink-0 border-border bg-accent text-accent-foreground hover:brightness-90 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground disabled:opacity-100"
          type="button"
          onClick={() => {
            if (isReadOnly) {
              return;
            }
            setAddDialogOpen(true);
          }}
          disabled={isReadOnly}
          aria-disabled={isReadOnly}
          aria-label="Add subject tab"
          aria-haspopup="dialog"
          aria-expanded={addDialogOpen}
        >
          <span data-add-tab-glyph aria-hidden>
            +
          </span>
        </Button>

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
            className="mx-auto flex min-h-0 min-w-10 flex-1 snap-y snap-mandatory flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-muted hidden-scrollbar"
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
                    setAddDialogOpen(false);
                    void onEnsureActiveSubjectTab(tab.id);
                    if (isReadOnly) {
                      return;
                    }
                    setRenameTarget(tab);
                  }}
                  className="w-[calc(var(--air-cell)*3)]! h-[calc(var(--air-cell)*3)]! shrink-0 snap-start justify-start leading-tight rotate-90 translate-x-[2.5rem] origin-top-left"
                >
                  {tab.name.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>
    </>
  );
});
