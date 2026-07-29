/** SUBJECT-TABS-1 — 25 including spaces, per the client's add/rename modal note. Enforced at the
 *  inputs and again on the storage path. */
export const SUBJECT_TAB_NAME_MAX_LEN = 25;

export function clampSubjectTabName(name: string): string {
  return name.slice(0, SUBJECT_TAB_NAME_MAX_LEN);
}
