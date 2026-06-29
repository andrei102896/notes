import {
  LOADING_VEIL_FADE_MS,
  LOADING_VEIL_HOLD_MS,
  LOADING_VEIL_ID,
  OVERLAY_SHELL_ID,
} from "@/content/constants";

let loadingVeilTimer: number | null = null;
let loadingVeilAnimation: Animation | null = null;

/** Pointer-transparent, self-clearing frost over a cold restore; can never strand the panel. */
export function showLoadingVeil(): void {
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  if (!shell) {
    return;
  }
  removeLoadingVeil();

  const veil = document.createElement("div");
  veil.id = LOADING_VEIL_ID;
  veil.setAttribute("aria-hidden", "true");
  // pointer-events:none guarantees the panel stays clickable even if the veil ever lingers.
  veil.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:1",
    "background:rgba(248,248,248,0.45)",
    "backdrop-filter:blur(8px)",
    "-webkit-backdrop-filter:blur(8px)",
    "pointer-events:none",
  ].join(";");
  shell.appendChild(veil);

  const total = LOADING_VEIL_HOLD_MS + LOADING_VEIL_FADE_MS;
  try {
    // fill:forwards settles the veil at opacity 0 even if cleanup is starved, so it never sticks.
    const animation = veil.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: LOADING_VEIL_HOLD_MS / total },
        { opacity: 0, offset: 1 },
      ],
      { duration: total, easing: "ease-out", fill: "forwards" },
    );
    loadingVeilAnimation = animation;
    animation.onfinish = () => removeLoadingVeil();
  } catch {
    // Web Animations unavailable — remove on a plain timer (still pointer-transparent).
    loadingVeilTimer = window.setTimeout(removeLoadingVeil, total);
  }
}

export function removeLoadingVeil(): void {
  if (loadingVeilTimer !== null) {
    window.clearTimeout(loadingVeilTimer);
    loadingVeilTimer = null;
  }
  if (loadingVeilAnimation !== null) {
    try {
      loadingVeilAnimation.cancel();
    } catch {
      // Already finished/detached.
    }
    loadingVeilAnimation = null;
  }
  document.getElementById(LOADING_VEIL_ID)?.remove();
}
