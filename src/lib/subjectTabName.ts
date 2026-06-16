/** SUBJECT-TABS-1 — character limit enforced at inputs; storage uses the same cap. */
export const SUBJECT_TAB_NAME_MAX_LEN = 8;

export function clampSubjectTabName(name: string): string {
  return name.slice(0, SUBJECT_TAB_NAME_MAX_LEN);
}
