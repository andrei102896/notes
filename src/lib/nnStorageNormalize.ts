import { generateId } from "@/lib/generateId";
import { pruneEmptyNoteGroups } from "@/lib/nnNoteLayout";
import {
  DEFAULT_INDEX,
  DEFAULT_META,
  DEFAULT_NN_SYNC,
} from "@/lib/nnStorageDefaults";
import type {
  NNNoteIndex,
  NNNoteListGroup,
  NNNoteListLayout,
  NNSubjectTab,
  NNSyncMeta,
  NNSyncNote,
  NNSyncPayload,
} from "@/types/nnData";

export function normalizeMeta(raw: unknown): NNSyncMeta {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_META };
  }
  const o = raw as Record<string, unknown>;
  const layoutIndex = Array.isArray(o.layoutIndex)
    ? o.layoutIndex.map((k) => String(k)).filter((k) => k.length > 0)
    : [];
  return {
    subjectTabs: migrateSubjectTabs(o.subjectTabs),
    layoutIndex,
  };
}

export function normalizeIndex(raw: unknown): NNNoteIndex {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_INDEX };
  }
  const o = raw as Record<string, unknown>;
  const noteIds = Array.isArray(o.noteIds)
    ? o.noteIds.map((id) => String(id)).filter((id) => id.length > 0)
    : [];
  const bySubjectTab: Record<string, string[]> = {};
  if (o.bySubjectTab && typeof o.bySubjectTab === "object") {
    for (const [tabId, ids] of Object.entries(
      o.bySubjectTab as Record<string, unknown>,
    )) {
      if (!Array.isArray(ids)) {
        continue;
      }
      bySubjectTab[tabId] = ids
        .map((id) => String(id))
        .filter((id) => id.length > 0);
    }
  }
  return { noteIds, bySubjectTab };
}

export function migrateSubjectTabs(raw: unknown): NNSubjectTab[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (!item || typeof item !== "object") {
      return {
        id: generateId(),
        name: "",
        createdAt: Date.now(),
      };
    }
    const t = item as Record<string, unknown>;
    return {
      id: String(t.id ?? generateId()),
      name: String(t.name ?? ""),
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    };
  });
}

export function migrateNote(raw: unknown): NNSyncNote | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const n = raw as Record<string, unknown>;
  const rawAnchor = n.anchor;
  const anchor =
    rawAnchor &&
    typeof rawAnchor === "object" &&
    typeof (rawAnchor as Record<string, unknown>).pageX === "number" &&
    typeof (rawAnchor as Record<string, unknown>).pageY === "number" &&
    typeof (rawAnchor as Record<string, unknown>).elementSelector === "string"
      ? (rawAnchor as import("@/types/nnData").NNAnchorPosition)
      : null;
  const id = String(n.id ?? "");
  if (!id) {
    return null;
  }
  return {
    id,
    subjectTabId: String(n.subjectTabId ?? ""),
    url: typeof n.url === "string" ? n.url : "",
    heading: typeof n.heading === "string" ? n.heading : "",
    body: typeof n.body === "string" ? n.body : "",
    createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
    anchor,
    isExpanded: typeof n.isExpanded === "boolean" ? n.isExpanded : true,
  };
}

export function migrateNotes(raw: unknown): NNSyncNote[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => migrateNote(item))
    .filter((n): n is NNSyncNote => n !== null);
}

export function coerceNoteListLayout(v: unknown): NNNoteListLayout | null {
  if (!v || typeof v !== "object") {
    return null;
  }
  const o = v as Record<string, unknown>;
  const groupsRaw = o.groups;
  if (!Array.isArray(groupsRaw)) {
    return null;
  }
  const groups: NNNoteListGroup[] = [];
  for (const g of groupsRaw) {
    if (!g || typeof g !== "object") {
      continue;
    }
    const gr = g as Record<string, unknown>;
    const id =
      typeof gr.id === "string" && gr.id.length > 0 ? gr.id : generateId();
    const ids = Array.isArray(gr.noteIds)
      ? gr.noteIds.map((x) => String(x)).filter((s) => s.length > 0)
      : [];
    groups.push({ id, noteIds: ids });
  }
  const gapRaw = o.gapBeforePxByNoteId;
  const gapBeforePxByNoteId: Record<string, number> = {};
  if (gapRaw && typeof gapRaw === "object") {
    for (const [k, val] of Object.entries(gapRaw)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        gapBeforePxByNoteId[k] = Math.max(0, Math.round(val));
      }
    }
  }
  const layout: NNNoteListLayout = { groups, gapBeforePxByNoteId };
  pruneEmptyNoteGroups(layout);
  if (layout.groups.length === 0) {
    return null;
  }
  return layout;
}

export function migrateNoteLayouts(
  raw: unknown,
): Record<string, NNNoteListLayout> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object") {
    return undefined;
  }
  const out: Record<string, NNNoteListLayout> = {};
  for (const [k, v] of Object.entries(raw)) {
    const layout = coerceNoteListLayout(v);
    if (layout) {
      out[k] = layout;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Normalizes legacy monolithic blob or assembled payload. */
export function migrateNNSyncPayload(raw: unknown): NNSyncPayload {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_NN_SYNC;
  }
  const o = raw as Record<string, unknown>;
  return {
    subjectTabs: migrateSubjectTabs(o.subjectTabs),
    notes: migrateNotes(o.notes),
    noteLayouts: migrateNoteLayouts(o.noteLayouts),
  };
}
