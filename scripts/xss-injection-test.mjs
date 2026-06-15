/**
 * Automated XSS regression test for the Notes For Net overlay.
 *
 * What it does:
 *  1. Launches Chromium with the REAL built extension (`dist/`) loaded.
 *  2. Seeds a malicious note directly into chrome.storage.local via the
 *     extension service worker &mdash; body = an <img onerror> payload.
 *  3. Opens the target page (Ferrari by default), reveals the overlay.
 *  4. The app renders the note through its real sink
 *     (RichTextBodyEditor: `editor.innerHTML = value`), which parses the
 *     <img> and fires `onerror` in the host page's origin if unsanitized.
 *  5. Detects execution and reports VULNERABLE vs SAFE.
 *
 * Regression test for the planned note-body sanitization fix:
 *   - TODAY (no sanitizer):   payload executes  -> "VULNERABLE" -> exit 1
 *   - AFTER the fix lands:    payload neutered  -> "SAFE"       -> exit 0
 *
 * Prereqs (one time):
 *   npm run build && npm i -D playwright && npx playwright install chromium
 * Run:
 *   node scripts/xss-injection-test.mjs
 *   HEADLESS=1 node scripts/xss-injection-test.mjs
 *   TARGET_URL="https://example.com/" node scripts/xss-injection-test.mjs
 */

import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(SCRIPT_DIR, "..", "dist");

// Default to a STABLE page. Heavy SPAs (e.g. ferrari.com) mutate their URL after
// load, which makes the dashboard re-run its init effect and reset the selected
// subject tab to null (a real product bug) &mdash; that resets the rendered note and
// makes the test flaky. Override with TARGET_URL to test any specific site.
const TARGET_URL = process.env.TARGET_URL ?? "https://example.com/";
const HEADLESS = process.env.HEADLESS === "1";
const WATCH = process.env.WATCH === "1"; // headed + visible banner + keep browser open
const NAV_TIMEOUT = 60_000;

const OVERLAY_SHELL_ID = "nn-scroll-bookmarks-overlay-shell";
const TAB_ID = "tab-xss-poc";
const NOTE_ID = "note-xss-poc";
const TAB_NAME = "XSS";

/**
 * The code a malicious note silently runs on the host page. It (1) sets a detection
 * flag, and (2) paints a plain-language, client-friendly "this site was hijacked"
 * takeover that proves access by reading the page's real content/cookies. Written as
 * normal JS, then base64-encoded into the note payload so quoting stays clean.
 * It only reads/displays locally &mdash; nothing is sent anywhere (safe demo).
 */
const XSS_DEMO_JS = `
(function () {
  try {
    var w = window.top, d = w.document;
    w.__NN_XSS_FIRED = String(d.domain || "fired");
    if (d.getElementById("nn-xss-demo")) return;
    var snippet = (d.body ? d.body.innerText : "").replace(/[<>]/g, " ").replace(/\\s+/g, " ").trim().slice(0, 160);
    var cookies = d.cookie || "(this demo page stores none &mdash; on your email or bank, this is your live login session)";
    var ls = Object.keys(w.localStorage || {}).join(", ") || "(none on this demo page)";
    var ov = d.createElement("div");
    ov.id = "nn-xss-demo";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(12,12,16,.96);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;padding:24px";
    ov.innerHTML =
      '<div style="max-width:760px;width:100%;max-height:92vh;overflow:auto;background:#ffffff;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.6)">' +
      '<div style="background:#c0152f;color:#fff;padding:24px 30px;font-size:26px;font-weight:800;line-height:1.2">&#9888;&#65039; This website was just hijacked &mdash; by a saved note</div>' +
      '<div style="padding:26px 30px;color:#18181b;font-size:17px;line-height:1.6">' +
      '<p style="margin:0 0 14px">You did <b>not</b> click anything. Just opening a note in the <b>Notes for Net</b> browser extension ran a stranger&rsquo;s code on <b>' + d.domain + '</b> &mdash; as if it were this site&rsquo;s own code.</p>' +
      '<div style="background:#fff7ed;border:1px solid #fdba74;border-left:5px solid #ea580c;border-radius:8px;padding:12px 16px;margin:0 0 18px;font-size:15px;line-height:1.5">' +
      '<b style="color:#9a3412">The culprit is the extension &mdash; not this website.</b><br>' +
      'This did <b>not</b> come from ' + d.domain + '. It came from a note saved in <b>Notes for Net</b>, which shows note content <b>without cleaning it first</b>. So a booby-trapped note runs its hidden code on <b>whatever site you open</b> &mdash; ' + d.domain + ' is just where it landed this time. The same note fires on every site you visit.</div>' +
      '<p style="margin:0 0 8px;font-weight:700">Running as this site, that note can right now:</p>' +
      '<ul style="margin:0 0 18px;padding-left:24px">' +
      '<li>Steal your <b>login session</b> &mdash; and sign in as you</li>' +
      '<li>Read <b>anything on the page</b>: typed passwords, account &amp; card details</li>' +
      '<li><b>Send it all to an attacker</b>, silently</li>' +
      '<li>Replace the page with a <b>fake login or checkout</b></li></ul>' +
      '<div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:14px 16px;font:13px ui-monospace,monospace;color:#3f3f46;word-break:break-all">' +
      '<div style="font:700 13px system-ui;color:#c0152f;margin-bottom:8px">LIVE PROOF &mdash; this note just read this site:</div>' +
      'Page: ' + w.location.href + '<br>Visible text: &ldquo;' + snippet + '&hellip;&rdquo;<br>Cookies: ' + cookies + '<br>Stored data: ' + ls + '</div>' +
      '<p style="margin:16px 0 0;font-size:14px;color:#71717a">Safe demonstration &mdash; nothing left this computer. <b>This website is not at fault.</b> The fix lives in the extension: <b>Notes for Net must clean (sanitize) note content before it is displayed.</b></p>' +
      '</div></div>';
    d.body.appendChild(ov);
  } catch (e) {
    window.__NN_XSS_FIRED = "fired";
  }
})();
`;

const PAYLOAD = `<img src=x onerror="eval(atob('${Buffer.from(XSS_DEMO_JS).toString("base64")}'))">`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[xss-test]", ...a);

/** Mirrors consumePendingSubjectTabId key variants (useNNDashboardSession.ts). */
function pendingTabKeys(href) {
  const trim = (u) => (u.length > 1 && u.endsWith("/") ? u.slice(0, -1) : u);
  const keys = new Set([
    `nn_pending_subject_tab_${href}`,
    `nn_pending_subject_tab_${trim(href)}`,
  ]);
  try {
    keys.add(`nn_pending_subject_tab_${trim(new URL(href).href)}`);
  } catch {
    /* best effort */
  }
  return [...keys];
}

function buildSeed(noteUrl, now) {
  const seed = {
    nnSyncMeta: {
      subjectTabs: [{ id: TAB_ID, name: TAB_NAME, createdAt: now }],
      layoutIndex: [],
    },
    nnNoteIndex: { noteIds: [NOTE_ID], bySubjectTab: { [TAB_ID]: [NOTE_ID] } },
    [`nnNote:${NOTE_ID}`]: {
      id: NOTE_ID,
      subjectTabId: TAB_ID,
      url: noteUrl,
      heading: "XSS PoC",
      body: PAYLOAD,
      createdAt: now,
      isExpanded: true,
    },
  };
  // The default (no-tab) view only renders the instruction in this build, so the
  // subject tab must be selected. Seed the pending-subject-tab handoff so it
  // auto-selects on mount (consumed once by useNNDashboardSession on load).
  for (const k of pendingTabKeys(noteUrl)) seed[k] = TAB_ID;
  return seed;
}

async function getServiceWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  return sw;
}

/** Repeatedly request the overlay until its iframe appears (handles content-script readiness race). */
async function revealOverlay(page, sw, finalUrl) {
  for (let i = 0; i < 30; i++) {
    if (await page.$(`#${OVERLAY_SHELL_ID} iframe`)) return true;

    // Path 1: the content script's own visibility event (idempotent show).
    await page
      .evaluate(() => {
        window.dispatchEvent(
          new CustomEvent("nn-dashboard-overlay-visibility-request", {
            detail: { visible: true },
          }),
        );
      })
      .catch(() => {});

    // Path 2 (every few tries): the real toolbar path &mdash; TOGGLE_OVERLAY from the SW.
    if (i === 2 || i === 8) {
      await sw
        .evaluate(async (url) => {
          const tabs = await chrome.tabs.query({});
          const t =
            tabs.find((x) => x.url && x.url.startsWith(url)) ||
            tabs.find((x) => x.active);
          if (t?.id) chrome.tabs.sendMessage(t.id, { type: "TOGGLE_OVERLAY" });
        }, finalUrl)
        .catch(() => {});
    }
    await sleep(500);
  }
  return Boolean(await page.$(`#${OVERLAY_SHELL_ID} iframe`));
}

async function diagnostics(page, sw) {
  try {
    const shell = await page.$(`#${OVERLAY_SHELL_ID}`);
    const iframe = await page.$(`#${OVERLAY_SHELL_ID} iframe`);
    log(`diag: shell=${!!shell} iframe=${!!iframe}`);
    if (iframe) {
      const txt = await page
        .frameLocator(`#${OVERLAY_SHELL_ID} iframe`)
        .locator("body")
        .innerText()
        .catch(() => "(unreadable)");
      log(`diag: iframe text (first 200): ${JSON.stringify(txt.slice(0, 200))}`);
    }
    const keys = await sw.evaluate(async () =>
      Object.keys(await chrome.storage.local.get(null)),
    );
    log(`diag: storage keys = ${JSON.stringify(keys)}`);
  } catch (e) {
    log("diag failed:", e?.message ?? e);
  }
}

/** Paints a verdict banner on the host page. Uses CDP eval, so it shows even under a strict CSP. */
async function paintBanner(page, text, bg) {
  await page
    .evaluate(
      ({ text, bg }) => {
        const d = document.createElement("div");
        d.textContent = text;
        d.style.cssText =
          "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:" +
          bg +
          ";color:#fff;font:bold 20px system-ui,sans-serif;padding:18px;text-align:center";
        document.body.appendChild(d);
      },
      { text, bg },
    )
    .catch(() => {});
}

async function main() {
  if (!existsSync(DIST_PATH)) {
    log(`ERROR: ${DIST_PATH} not found. Run \`npm run build\` first.`);
    process.exit(2);
  }
  log(`Loading extension from: ${DIST_PATH}`);
  log(`Target page: ${TARGET_URL}`);

  const args = [
    `--disable-extensions-except=${DIST_PATH}`,
    `--load-extension=${DIST_PATH}`,
  ];
  if (HEADLESS && !WATCH) args.push("--headless=new");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args,
  });

  let exitCode = 2;
  let page = null;
  try {
    const sw = await getServiceWorker(context);
    log(`Extension service worker up. id=${new URL(sw.url()).host}`);

    page = await context.newPage();
    let dialogFired = false;
    page.on("dialog", (d) => {
      dialogFired = true;
      log(`dialog() fired: "${d.message()}"`);
      d.dismiss().catch(() => {});
    });

    // A strict host-page CSP can block the inline handler &mdash; that's the SITE's
    // defense, not the extension's. Capture it so it never reads as a real pass.
    const cspBlocks = [];
    page.on("console", (m) => {
      const t = m.text();
      if (/content security policy|refused to (execute|run|apply)/i.test(t)) {
        cspBlocks.push(t);
      }
    });

    log("Navigating...");
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForLoadState("load").catch(() => {});
    const finalUrl = page.url();
    log(`Loaded: ${finalUrl}`);

    // Seed AFTER navigation (note.url must match the real post-redirect URL),
    // BEFORE revealing the overlay (app reads storage on first mount).
    await sw.evaluate(async (data) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
    }, buildSeed(finalUrl, Date.now()));
    log("Seeded malicious note into chrome.storage.local.");

    const shown = await revealOverlay(page, sw, finalUrl);
    if (!shown) {
      log("Overlay iframe never appeared.");
      await diagnostics(page, sw);
      console.log("\n" + "=".repeat(60));
      log("RESULT: INCONCLUSIVE &mdash; overlay never mounted (trigger/CS issue).");
      console.log("=".repeat(60) + "\n");
      return;
    }
    log("Overlay iframe mounted.");

    const frame = page.frameLocator(`#${OVERLAY_SHELL_ID} iframe`);
    const body = frame.locator("[data-note-body]").first();

    // Notes only render with a subject tab selected (default view shows only the
    // instruction). Force-click the seeded "XSS" tab &mdash; force bypasses the hit-test
    // that fails on the rotate-90/translate tab &mdash; retrying to ride out re-renders.
    let rendered = false;
    for (let i = 0; i < 8 && !rendered; i++) {
      if (await body.count()) {
        rendered = true;
        break;
      }
      await frame
        .getByText(TAB_NAME, { exact: false })
        .first()
        .click({ force: true, timeout: 3_000 })
        .catch(() => {});
      rendered = await body
        .waitFor({ state: "attached", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!rendered) {
      await diagnostics(page, sw);
      console.log("\n" + "=".repeat(60));
      log("RESULT: INCONCLUSIVE &mdash; overlay up but note never rendered.");
      console.log("=".repeat(60) + "\n");
      return;
    }
    log("Note body editor rendered.");

    await page
      .waitForFunction(() => window.__NN_XSS_FIRED !== undefined, {
        timeout: 3_000,
      })
      .catch(() => {});
    const fired = await page.evaluate(() => window.__NN_XSS_FIRED ?? null);

    console.log("\n" + "=".repeat(60));
    if (fired || dialogFired) {
      log(`RESULT: VULNERABLE - XSS executed in origin "${fired}".`);
      log("Stored note body ran script via editor.innerHTML = value.");
      log("(Expected until sanitization lands; then this flips to SAFE.)");
      exitCode = 1;
    } else if (cspBlocks.length > 0) {
      log("RESULT: BLOCKED BY HOST CSP - not by the extension.");
      log(`  CSP refusal: ${cspBlocks[0].slice(0, 160)}`);
      log("  The note-body sink is still UNSANITIZED; it fires on any site");
      log("  without a strict script-src (e.g. example.com, ferrari.com).");
      exitCode = 1; // the extension is NOT actually safe
      if (WATCH)
        await paintBanner(
          page,
          "🛡️ BLOCKED BY THIS SITE'S CSP - the note's code did NOT run here. " +
            "Your CSP protected the page; the extension sink is still vulnerable on sites without a strict CSP.",
          "#127c2b",
        );
    } else {
      log("RESULT: SAFE - payload did NOT execute (body sanitized by the extension). ✅");
      exitCode = 0;
      if (WATCH)
        await paintBanner(
          page,
          "✅ SAFE - the note body was sanitized by the extension; no code ran.",
          "#127c2b",
        );
    }
    console.log("=".repeat(60) + "\n");
  } catch (err) {
    log("ERROR:", err?.message ?? err);
    exitCode = 2;
  } finally {
    if (WATCH && page) {
      log("WATCH mode: browser stays open &mdash; inspect the panel + red banner.");
      log("Close the browser window (or press Ctrl+C here) to exit.");
      await page.waitForEvent("close", { timeout: 600_000 }).catch(() => {});
    }
    await context.close();
  }
  process.exit(exitCode);
}

main();
