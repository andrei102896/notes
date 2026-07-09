import React, { useCallback, useEffect, useRef, useState } from "react";

import { useNNDashboardSession } from "@/hooks/useNNDashboardSession";
import {
  getExtPayClient,
  isExtPayConfigured,
} from "@/lib/extpay";
import { AlphabetIndexRollout } from "@/overlay/AlphabetIndexRollout";
import {
  DashboardContent,
  type DashboardContentHandle,
} from "@/overlay/DashboardContent";
import { DashboardFooter } from "@/overlay/DashboardFooter";
import { DashboardHeader } from "@/overlay/DashboardHeader";
import { PaywallDialog } from "@/overlay/PaywallDialog";
import {
  SubjectTabStrip,
  type SubjectTabStripHandle,
} from "@/overlay/SubjectTabStrip";


const TRIAL_START_STORAGE_KEY = "nn_trial_started_at";
const TRIAL_BANNER_OPEN_KEY = "nn_trial_banner_open";

const IS_PROD_TRIAL = import.meta.env.VITE_TRIAL_MODE === "prod";
const TRIAL_WINDOW_MS = IS_PROD_TRIAL
  ? 7 * 24 * 60 * 60 * 1000
  : 7 * 60 * 1000;
const TRIAL_UNIT_MS = IS_PROD_TRIAL ? 24 * 60 * 60 * 1000 : 60 * 1000;
type TrialUnit = "days" | "minutes";
const TRIAL_UNIT: TrialUnit = IS_PROD_TRIAL ? "days" : "minutes";

async function getOrInitLocalTrialStartMs(): Promise<number> {
  const result = await chrome.storage.local.get(TRIAL_START_STORAGE_KEY);
  const existing = result[TRIAL_START_STORAGE_KEY];
  if (typeof existing === "number" && Number.isFinite(existing) && existing > 0) {
    return existing;
  }
  const now = Date.now();
  await chrome.storage.local.set({ [TRIAL_START_STORAGE_KEY]: now });
  return now;
}


export function App(): React.ReactElement {
  const {
    sync,
    pageSession,
    patchSession,
    visibleNotes,
    browserTabUrlKey,
    addSubjectTab,
    deleteSubjectTab,
    renameSubjectTab,
    addNote,
    updateNote,
    deleteNote,
    deleteAllNotesInSubjectTab,
    resolvedNoteListLayout,
    commitNoteListLayoutForCurrentView,
    setNotesExpanded,
  } = useNNDashboardSession();

  const subjectTabsForDisplay = sync.subjectTabs.map((t) => ({
    id: t.id,
    name: t.name,
  }));
  // First launch (no tabs) gets the "create a tab" prompt; tabs-but-none-selected gets "select or create".
  const emptyState: "first-run" | "select-or-create" | null =
    subjectTabsForDisplay.length === 0
      ? "first-run"
      : pageSession.activeSubjectTabId === null
        ? "select-or-create"
        : null;

  const subjectTabStripRef = useRef<SubjectTabStripHandle>(null);
  const dashboardContentRef = useRef<DashboardContentHandle>(null);
  const trialExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trialStartMsRef = useRef<number | null>(null);
  const [hasInvalidUrlDraft, setHasInvalidUrlDraft] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  // Lifted from SubjectTabStrip so the empty-state panel hides while the add-tab dialog is open.
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [, setHighlightedNoteId] = useState<string | null>(null);
  const [trialBannerOpen, setTrialBannerOpen] = useState(false);
  const [trialBannerLoaded, setTrialBannerLoaded] = useState(false);
  const [isUserPaid, setIsUserPaid] = useState(false);
  const [isOnActiveTrial, setIsOnActiveTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const effectiveActiveNoteId = visibleNotes.some((n) => n.id === activeNoteId)
    ? activeNoteId
    : null;

  const refreshBillingAccess = useCallback(async () => {
    try {
      const trialStartMs = await getOrInitLocalTrialStartMs();
      trialStartMsRef.current = trialStartMs;
      const elapsed = Date.now() - trialStartMs;
      const hasActiveTrial = elapsed < TRIAL_WINDOW_MS;
      const paid = isExtPayConfigured
        ? Boolean((await getExtPayClient().getUser()).paid)
        : false;

      setIsUserPaid(paid);
      setIsOnActiveTrial(hasActiveTrial);

      if (trialExpiryTimerRef.current !== null) {
        clearTimeout(trialExpiryTimerRef.current);
        trialExpiryTimerRef.current = null;
      }

      if (!paid && hasActiveTrial) {
        setTrialDaysLeft(
          Math.max(1, Math.ceil((TRIAL_WINDOW_MS - elapsed) / TRIAL_UNIT_MS)),
        );
        const msUntilExpiry = TRIAL_WINDOW_MS - elapsed;
        trialExpiryTimerRef.current = setTimeout(() => {
          void refreshBillingAccess();
        }, msUntilExpiry);
      } else {
        setTrialDaysLeft(null);
      }
    } catch {
      setIsUserPaid(false);
      const trialStartMs = await getOrInitLocalTrialStartMs();
      trialStartMsRef.current = trialStartMs;
      const elapsed = Date.now() - trialStartMs;
      const hasActiveTrial = elapsed < TRIAL_WINDOW_MS;
      setIsOnActiveTrial(hasActiveTrial);
      setTrialDaysLeft(
        hasActiveTrial
          ? Math.max(1, Math.ceil((TRIAL_WINDOW_MS - elapsed) / TRIAL_UNIT_MS))
          : null,
      );
    }
  }, []);

  // Read-only once the local 7-day trial ends unpaid; trial is local-only storage, so reinstall resets it (intentional).
  const isReadOnly = isExtPayConfigured && !isUserPaid && !isOnActiveTrial;

  useEffect(() => {
    void refreshBillingAccess();
  }, [refreshBillingAccess]);

  useEffect(() => {
    if (!isOnActiveTrial || isUserPaid) {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const TICK_MS = IS_PROD_TRIAL ? 60_000 : 1_000;

    const tick = () => {
      const startMs = trialStartMsRef.current;
      if (startMs === null) return;
      const remaining = TRIAL_WINDOW_MS - (Date.now() - startMs);
      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
        void refreshBillingAccess();
        return;
      }
      const next = Math.max(1, Math.ceil(remaining / TRIAL_UNIT_MS));
      setTrialDaysLeft((prev) => (prev === next ? prev : next));
    };

    countdownIntervalRef.current = setInterval(tick, TICK_MS);
    return () => {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isOnActiveTrial, isUserPaid, refreshBillingAccess]);

  useEffect(() => {
    chrome.storage.local.get(TRIAL_BANNER_OPEN_KEY, (result) => {
      if (result[TRIAL_BANNER_OPEN_KEY] === true) {
        setTrialBannerOpen(true);
      }
      setTrialBannerLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!trialBannerLoaded) {
      return;
    }
    void chrome.storage.local.set({ [TRIAL_BANNER_OPEN_KEY]: trialBannerOpen });
  }, [trialBannerOpen, trialBannerLoaded]);


  useEffect(() => {
    const handler = () => {
      void refreshBillingAccess();
    };
    window.addEventListener("nn-payment-completed", handler);
    return () => window.removeEventListener("nn-payment-completed", handler);
  }, [refreshBillingAccess]);

  const openPaymentPage = useCallback(() => {
    if (!isExtPayConfigured) {
      return;
    }
    getExtPayClient().openPaymentPage();
  }, []);

  // Restore an existing purchase after reinstall — ExtPay matches the account by Stripe email.
  // Log-in / restore-purchase flow removed from the paywall UI for now; kept for future revival.
  /* const openLoginPage = useCallback(() => {
    if (!isExtPayConfigured) {
      return;
    }
    getExtPayClient().openLoginPage();
  }, []); */

  return (
    <main
      id="nn-scroll-bookmarks-overlay-host"
      className="relative flex h-full w-full min-w-0 flex-row justify-end border-[3px] border-[#282828]"
    >
      <PaywallDialog
        open={trialBannerOpen && (trialDaysLeft !== null || isReadOnly)}
        onOpenChange={setTrialBannerOpen}
        trialDaysLeft={trialDaysLeft}
        trialUnit={TRIAL_UNIT}
        onBuy={openPaymentPage}
        // onLogin={openLoginPage}
      />
      <AlphabetIndexRollout
        tabs={subjectTabsForDisplay}
        onLetterSelect={(letter) => {
          subjectTabStripRef.current?.scrollToFirstLetter(letter);
        }}
        className="animate-in duration-200"
      />

      <SubjectTabStrip
        ref={subjectTabStripRef}
        tabs={subjectTabsForDisplay}
        activeSubjectTabId={pageSession.activeSubjectTabId}
        addDialogOpen={addDialogOpen}
        onAddDialogOpenChange={setAddDialogOpen}
        isReadOnly={isReadOnly}
        onSelectTab={(id) => {
          if (pageSession.activeSubjectTabId === id) {
            patchSession({ activeSubjectTabId: null });
            return;
          }
          patchSession({ activeSubjectTabId: id });
        }}
        onCreateTab={async (name) => {
          if (isReadOnly) {
            return;
          }
          const id = await addSubjectTab(name);
          if (id !== null) {
            patchSession({ activeSubjectTabId: id });
          }
        }}
        onEnsureActiveSubjectTab={(id) => {
          patchSession({ activeSubjectTabId: id });
        }}
        onRenameSubjectTab={(id, name) => {
          if (isReadOnly) {
            return;
          }
          void renameSubjectTab(id, name);
        }}
      />

      <div className="flex w-[calc(100%-var(--spacing)*10*2)] flex-col">
        <DashboardHeader
          activeSubjectTabId={pageSession.activeSubjectTabId}
          disableAddNote={hasInvalidUrlDraft}
          trialDaysLeft={trialDaysLeft}
          isReadOnly={isReadOnly}
          onTrialBannerOpenChange={setTrialBannerOpen}
          onAddNote={async () => {
            if (isReadOnly) {
              return;
            }
            const createdNoteId = await addNote();
            if (createdNoteId) {
              setActiveNoteId(createdNoteId);
              // New note prepends to the top; scroll the dashboard to reveal it.
              dashboardContentRef.current?.scrollNotesToTop();
            }
          }}
          onDeleteActiveSubjectTab={async () => {
            if (isReadOnly) {
              return;
            }
            const id = pageSession.activeSubjectTabId;
            if (id !== null) {
              await deleteSubjectTab(id);
            }
          }}
          onMinAllNotes={() => {
            const tabNoteIds = sync.notes
              .filter((n) => n.subjectTabId === pageSession.activeSubjectTabId)
              .map((n) => n.id);
            setNotesExpanded(tabNoteIds, false);
          }}
          onMaxAllNotes={() => {
            const tabNoteIds = sync.notes
              .filter((n) => n.subjectTabId === pageSession.activeSubjectTabId)
              .map((n) => n.id);
            setNotesExpanded(tabNoteIds, true);
          }}
          onDeleteAllNotes={async () => {
            if (isReadOnly) {
              return;
            }
            const id = pageSession.activeSubjectTabId;
            if (id !== null) {
              await deleteAllNotesInSubjectTab(id);
            }
          }}
        />
        <DashboardContent
          ref={dashboardContentRef}
          notes={visibleNotes}
          browserTabUrlKey={browserTabUrlKey}
          activeSubjectTabId={pageSession.activeSubjectTabId}
          activeNoteId={effectiveActiveNoteId}
          emptyState={addDialogOpen ? null : emptyState}
          onRequestAddSubjectTab={() => setAddDialogOpen(true)}
          isReadOnly={isReadOnly}
          onUpdateNote={(noteId, patch) => {
            if (isReadOnly) {
              return;
            }
            return updateNote(noteId, patch);
          }}
          onHighlightNote={setHighlightedNoteId}
          onHasInvalidUrlDraftChange={setHasInvalidUrlDraft}
          isNoteExpanded={(noteId) =>
            visibleNotes.find((n) => n.id === noteId)?.isExpanded ?? true
          }
          onSetNoteExpanded={(noteId, expanded) => {
            /** expand/collapse is a view-only operation; allow in read-only too. */
            void updateNote(noteId, { isExpanded: expanded });
          }}
          onDeleteNote={(noteId) => {
            if (isReadOnly) {
              return;
            }
            return deleteNote(noteId);
          }}
          onActivateNote={setActiveNoteId}
          resolvedNoteListLayout={resolvedNoteListLayout}
          onCommitNoteListLayout={(layout) => {
            if (isReadOnly) {
              return Promise.resolve();
            }
            return commitNoteListLayoutForCurrentView(layout);
          }}
        />
        <DashboardFooter />
      </div>

    </main>
  );
}
