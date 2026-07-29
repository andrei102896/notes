/** Opens a URL in a new browser tab via the background worker, falling back to window.open. */
export function openInNewTab(targetUrl: string): void {
  chrome.runtime.sendMessage(
    {
      type: "OPEN_URL_IN_NEW_TAB",
      payload: { url: targetUrl },
    },
    (response?: { ok?: boolean }) => {
      if (response?.ok) {
        return;
      }
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    },
  );
}
