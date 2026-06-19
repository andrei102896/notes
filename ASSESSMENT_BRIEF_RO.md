# Notes For Net (NN) — Brief de evaluare tehnică

**Data:** 11 iunie 2026 · **Scop:** evaluare completă a codului livrat de agenție
(Tapptitude), fără nicio modificare de cod. Document destinat deciziei de scope și
estimării lucrărilor de remediere.

**Metodologie:** întreg codul sursă (~8.000 linii TS/TSX în ~40 fișiere) a fost citit și
trasat; concluziile majore au fost verificate independent, de două ori (audit + verificare
adversarială pe cod, cu referințe fișier:linie). `npm run typecheck` și `npm run lint`
trec curat. Nicio comandă git nu a fost rulată; niciun fișier existent nu a fost modificat.

---

## 1. Rezumat executiv

Vestea bună: **codul este mai complet și mai îngrijit decât sugerează livrarea haotică.**
Aproape toate funcționalitățile de bază (tab-uri subiect, note, rich text, LINK/ANCHOR/
COPY/PASTE, drag-and-drop, persistență) sunt implementate și legate cap-coadă, iar
calitatea per-fișier e peste media livrărilor de agenție (TypeScript strict, tipare curate,
comentarii utile).

Vestea proastă, în patru puncte:

1. **Defectul de dimensionare are o cauză clară și confirmată:** panoul are lățime
   fixă de ~758 px CSS pe orice ecran, fără nicio logică de adaptare la viewport sau la
   scalarea Windows, iar scara interioară (text 24px, controale 40px) e „hardcodată" în
   fiecare componentă. Nu e un bug punctual — e o decizie de design distribuită în ~13
   fișiere. Este cel mai mare item de efort.
2. **Build-ul livrat are sistemul de plată dezactivat:** a fost compilat fără ID-ul
   ExtensionPay (paywall-ul nu se activează niciodată, butonul BUY nu face nimic) și cu
   trial-ul de dezvoltare de **7 minute** în loc de 7 zile. Codul de plată în sine este
   complet — problema este de **configurare la build** (.env), nu de cod.
3. **Câteva elemente din design lipsesc complet din cod:** câmpul „price" din header-ul
   notei, comportamentul de „rollout" al barei A–Z, reordonarea tab-urilor prin drag,
   persistarea per-URL a tab-ului selectat (stratul de storage există, dar nu e apelat).
4. **Zero teste, zero logging, erori înghițite peste tot** — orice lucrare viitoare se
   verifică manual în browser, ceea ce umflă costul fiecărei modificări.

Verdict pe scurt: **nu e nevoie de rescriere.** Baza e sănătoasă; e nevoie de o lucrare
serioasă de dimensionare responsive, un rebuild corect configurat pentru plăți, completarea
a 3–4 funcționalități lipsă și o igienizare (securitate, metadate, cod mort).

---

## 2. Structură și stack

**Stack (versiuni rezolvate din lockfile):** Manifest V3 · Vite 5.4.21 + @crxjs/vite-plugin
2.5.0 · React 18.3.1 · TypeScript 6.0.3 · Tailwind CSS 4.3.0 (config CSS-first, fără
tailwind.config) · shadcn/ui peste pachetul umbrelă radix-ui · @dnd-kit (drag-and-drop
note) · ExtPay 3.1.2 (plăți). Prettier + ESLint 9 + husky pre-commit (lint + typecheck).

**Arhitectură:** service worker-ul (`background.ts`) trimite `TOGGLE_OVERLAY` către tab la
click pe iconița din toolbar (nu există popup sau side panel). Content script-ul
(`content.ts`, injectat pe `<all_urls>`) montează un `<div>` fix pe marginea dreaptă a
paginii, conținând un `<iframe>` în care e randată aplicația React; CSS-ul e injectat
inline în iframe (de aceea `dist/` nu are fișier .css — e normal, nu e build stricat).
Panoul și content script-ul rulează în același context JS, deci „protocolul" de mesaje
dintre ele e de fapt apeluri de funcții în memorie. Persistența: integral
`chrome.storage.local`, schemă shardată (`nnSyncMeta` / `nnNoteIndex` / `nnNote:<id>` /
`nnLayout:<key>`) cu migrări defensive.

**Stare repo:** `dist/` (build din 11.06.2026) e complet, încărcabil și sincron cu sursa —
dar e un artefact de DEV (vezi §4.2). `nn-chrome-extension.zip` e doar o arhivă a sursei
(livrarea agenției), nu un build. README-ul, numele pachetului („scroll-bookmarks-overlay")
și **descrierea din manifest care ajunge în Chrome Web Store** descriu toate un starter
vechi de „scroll bookmarks", nu produsul NN. Specificația reală nu există în repo —
comentariile citează un `anchor-keep-pm/jira.md` și ID-uri de tichete (NOTES-CORE-*,
AIR-2 etc.) care nu sunt livrate.

**Ciudățenii de versiuni:** runtime React 18 cu `@types/react` 19 (nepotrivire majoră de
tipuri), TypeScript 6.0 cu `ignoreDeprecations: "6.0"`, `@crxjs` declarat „beta" dar
rezolvat la stabil 2.5.0, `@tanstack/react-query` instalat și montat ca provider dar
**niciodată folosit** (greutate moartă).

---

## 3. Cauza defectului de dimensionare (CONFIRMATĂ)

Simptom raportat: UI-ul arată corect pe un ecran, supradimensionat și nealiniat pe altele.
Referință de calibrare: laptop 16" Windows, 1920×1080, scalare 100%.

Cauza este compusă din șase mecanisme, toate verificate în cod:

1. **Panoul nu are deloc logică de lățime.** Shell-ul primește doar
   `min-width:calc(718px + 0.25rem * 10)` și `max-width:100vw`
   (`content.ts:24, 319-337`). Fără `width`, lățimea efectivă cade pe min-width:
   **~758 px CSS constant, pe orice ecran**. Nimic din cod nu citește
   `window.innerWidth`, `devicePixelRatio` sau `matchMedia`; singura dimensiune adaptivă
   e înălțimea (sincronizată cu `visualViewport`). Aritmetica ocupării ecranului:

   | Mediu | Viewport CSS efectiv | Panoul ocupă |
   |---|---|---|
   | 1920×1080 @ 100% (referința) | 1920 px | **39%** |
   | 1920×1080 @ 125% (default frecvent pe Windows) | 1536 px | **49%** |
   | Laptop 1366×768 | 1366 px | **55%** |
   | 2560 @ 200% (ecrane HiDPI) | 1280 px | **59%** |

   Adică exact simptomul: calibrat vizual pe un ecran „larg", devine disproporționat pe
   restul. Sub ~758 px lățime de viewport, min-width bate max-width și **marginea stângă
   a panoului (bara A–Z + tab-urile) iese în afara ecranului**, fără scroll orizontal.

2. **Scara interioară e supradimensionată „by design", distribuit:** primitivele shadcn au
   fost re-temate la text de 24px (`text-2xl`) și controale de 40px (`h-10`) —
   `button.tsx:27`, `tabs.tsx:66`, header, titluri de note. Nu există niciun breakpoint
   responsive în panou. Nu e „un buton prea mare", e toată scara.

3. **Cuplaj px↔rem valabil doar la font de 16px:** iframe-ul nu își setează font-size pe
   rădăcină, deci setarea de font a utilizatorului din Chrome scalează toate lungimile rem,
   în timp ce constantele px rămân fixe — ex. tab-urile rotite de 120px cu
   `translate-x-[40px]` trebuie să se potrivească cu coloana `w-10` bazată pe rem
   (`SubjectTabStrip.tsx:269`), iar `NN_COLLAPSED_NOTE_HEADER_PX = 40` chiar documentează
   în comentariu presupunerea de 16px (`nnNoteLayout.ts:3-4`).

4. **Lățimea shell-ului depinde de font-size-ul paginii gazdă** (rem-ul din `calc` se
   rezolvă pe documentul gazdei) — panoul are lățimi ușor diferite pe site-uri diferite,
   pe același calculator.

5. **O singură valoare adaptivă există în tot UI-ul** (literele A–Z folosesc
   `clamp(...2.35vmin...)`) — ea scalează cu ecranul în timp ce tot ce e lângă ea e fix,
   garantând nealinieri relative pe înălțimi de ecran diferite.

6. **Fontul (Fjalla One) se încarcă din Google Fonts la runtime** din interiorul
   iframe-ului; CSP-ul paginii gazdă îl poate bloca → fallback cu metrici diferite →
   layout-ul pixel-calibrat se rupe diferit per site. (Și o dependență de rețea/privacy.)

**Suprafața de fix** (o corecție completă atinge ~13 fișiere): `content.ts` (strategia de
lățime + listeners), `styles.css` (scară-rădăcină explicită), `button/input/tabs.tsx`,
`SubjectTabStrip.tsx`, `nnNoteLayout.ts` + `NotesList.tsx` (inclusiv valori px **persistate
în storage** — `gapBeforePxByNoteId` cere considerată o migrare), `RichTextBodyEditor.tsx`
(`h-[181px]`), `DashboardHeader.tsx` (logo-uri SVG fixe), `App.tsx` (calculul coloanelor —
atenție, fișier cu cod de plată), `AlphabetIndexRollout.tsx`, `NoteUrlEditor.tsx`,
dialogurile. Detaliile complete, cu linii exacte, sunt în `AGENTS.md` §6.

---

## 4. Stare funcțională vs design

### 4.1 Ce funcționează (verificat prin trasare de cod; netestat la runtime)

| Funcționalitate | Stare |
|---|---|
| Toggle din toolbar (hide/reveal) | Funcțional, per-tab, cu animație slide. Starea NU persistă la navigare; pe pagini restricționate (chrome:// etc.) click-ul moare silențios. |
| Tab-uri subiect: creare/redenumire/ștergere + dialoguri | Funcțional. Sortare alfabetică forțată, nume max. 9 caractere. Scroll-ul e nativ (nu există handler de wheel custom). |
| Note: creare, URL auto, dată auto | Funcțional (URL din tab-ul curent, data creării afișată MM/DD/YYYY). |
| Rich text B/I/U + scurtături Ctrl+B/I/U | Funcțional, pe `document.execCommand` (API deprecat, dar operațional în Chrome). |
| Min/max per notă (persistat), ștergere cu confirmare | Funcțional. |
| LINK / ANCHOR / COPY / PASTE | Complet implementate, inclusiv pick-ul de ancoră cu cursor dedicat, restaurarea scroll-ului după navigare (același tab sau tab nou prin background) și buffer de copiere partajat între tab-uri. |
| Evidențierea notei când URL-ul ei = pagina curentă | Funcțională (poll la 350ms + evenimente history; potrivire exactă pe URL normalizat). |
| Drag-and-drop note: reordonare, multi-select, grupuri/secțiuni | Complet implementat cu @dnd-kit și persistat; partea cea mai riscantă (DnD în iframe) e compensată explicit în cod. |
| Bara A–Z (AIR) | Legată funcțional: click pe literă selectează primul tab cu litera respectivă și derulează la el. |
| Persistența notelor | Funcțională, integral `chrome.storage.local`, schemă shardată cu migrări. |

### 4.2 Ce este defect / incomplet

| Problemă | Detaliu | Severitate |
|---|---|---|
| **Trial → plată moarte în build-ul livrat** | Compilat fără `VITE_EXTPAY_EXTENSION_ID` (paywall scos complet la compilare; BUY = no-op) și fără `VITE_TRIAL_MODE=prod` (trial de **7 minute**, nu 7 zile — verificat în bundle-ul minificat). Codul e complet; lipsește configurarea + rebuild. Zonă OFF-LIMITS pentru modificări de cod. | **Critică** (pt. lansare) |
| Grupul „This Tab Notes" (Min/Max/Delete) | Mislabeled/miswired: butoanele sunt dezactivate exact în vizualizarea „this tab" (fără tab selectat) și operează pe notele folderului selectat, nu pe cele ale paginii. | Medie |
| Bara A–Z fără feedback vizual | `isActive` e calculat dar nefolosit la stilare; literele fără tab-uri arată identic cu cele active; nu există niciun comportament de „rollout" propriu-zis. | Medie |
| Deschiderea în tab nou nu redeschide panoul | Flag-ul `openOverlay` există în background, dar niciun apelant nu îl setează — la click-dreapta pe LINK/ANCHOR tab-ul nou se deschide cu panoul închis. | Mică |
| Trial resetabil prin reinstalare | Trial-ul e doar în storage local — documentat în cod ca intenționat; de confirmat ca decizie de business. | Info |

### 4.3 Ce lipsește complet din cod (verificat prin grep + citire integrală)

1. **Câmpul „price"** din header-ul notei — zero cod, zero câmp în schemă.
2. **Comportamentul „rollout"** al barei A–Z — bara e o coloană statică, permanent vizibilă.
3. **Reordonarea tab-urilor subiect prin drag** — inexistentă (și sortarea alfabetică
   forțată ar face-o inutilă fără o decizie de design).
4. **Persistarea per-URL a tab-ului selectat** — stratul de storage (`nnSessionsByUrl`,
   `getPageSession`/`patchPageSession`) e complet implementat dar **nu e apelat de nimeni**;
   la fiecare încărcare de pagină panoul pornește fără tab selectat. (Funcțiile au fost
   chiar eliminate de tree-shaking din build — dovadă că nu sunt folosite.)
5. **Persistarea stării vizibil/ascuns** a panoului între navigări.

---

## 5. Probleme, riscuri, securitate

### Securitate

- **XSS stocat prin corpul notei (risc real, de remediat):** HTML-ul din editorul
  contentEditable e salvat brut (`innerHTML`) și re-injectat la randare
  (`editor.innerHTML = value`, `RichTextBodyEditor.tsx:152`), **fără niciun sanitizer în
  repo și fără interceptarea paste-ului** (paste-ul nativ inserează HTML arbitrar).
  Atenuare: execuția are loc în iframe-ul cu originea paginii gazdă, nu în contextul
  privilegiat al extensiei — dar o notă creată pe site-ul A rulează script pe originea
  site-ului B când e afișată acolo. Necesită sanitizare la salvare/randare.
- **Pagina gazdă poate accesa DOM-ul panoului:** iframe-ul about:blank e same-origin cu
  pagina; un site ostil poate citi/modifica ce afișează panoul pe acel site. Risc moderat,
  inerent arhitecturii alese (alternativa ar fi iframe cu pagină de extensie).
- **Cheie/secrete:** nu există secrete hardcodate; ID-ul ExtensionPay nu e secret prin
  natură. `.env` lipsește (de aceea build-ul e dezactivat la plăți).

### Permisiuni & Chrome Web Store

- `tabs` și `activeTab` sunt **foarte probabil eliminabile** (codul folosește doar
  `tabs.create/sendMessage/query` pe `tab.id`, care nu cer permisiunea `tabs`);
  `<all_urls>` e inerent produsului; `unlimitedStorage` e justificat.
- **Descrierea din manifest e a produsului vechi** („Save bookmarks with exact scroll
  position...") — ar apărea așa în Web Store. Combinația `<all_urls>` + permisiuni
  ne-necesare + descriere nepotrivită = fricțiune previzibilă la review.
- Bundle-ul de content script are **415 KB și se injectează pe fiecare pagină vizitată**
  (inclusiv react-query, nefolosit). UI-ul se montează lazy, dar JS-ul se evaluează mereu.
- Fontul din Google Fonts = dependență de rețea + cerere către Google de pe fiecare panou.

### Robustețe

- **Zero logging, ~20 de `catch {}` goale, promisiuni aruncate cu `void`** — toate
  eșecurile sunt invizibile, inclusiv la scrierile în storage.
- **Scriere în storage la fiecare tastă** + două re-citiri complete ale întregului set de
  date per modificare (hook + subscription); la sute de note va produce lag la tastare și
  există o cursă care poate reseta caret-ul în editor.
- **Operațiile multi-cheie nu sunt atomice** (ștergerea unui tab = 4-5 scrieri secvențiale);
  o întrerupere sau două tab-uri care scriu simultan pot lăsa index/meta inconsistente
  (normalizatoarele de citire maschează tăcut).
- MV3: corect — listeners la top-level în service worker, fără cod remote (exceptând
  fontul, care e CSS, nu JS).

### Cod mort / înșelător

- Rămășițe ale starter-ului: handler `OPEN_SCROLL_BOOKMARK`, `types/bookmark.ts`, cheia
  `scrollBookmarks` — nimeni nu le apelează.
- **Capcana „sync":** namespace-ul `sync` din `storageService` e remapat în tăcere la
  `chrome.storage.local` — toată terminologia `NNSync*` minte; nimic nu se sincronizează
  între dispozitive, iar JSDoc-ul care promite asta e fals.
- Plumbing mort în UI: `isActive`/`onHighlightNote` cărate prin 4 niveluri de componente
  fără niciun efect vizual; `reorderNotes`, `PendingSyncMergeState`,
  `isContentToPanelMessage` — implementate, neapelate.
- „Protocol" ceremonios de 587 linii (versiuni, requestId, timeout-uri) pentru apeluri de
  funcții în același context, în timp ce mesajele runtime reale (background↔content) n-au
  niciun tip partajat.

---

## 6. Verdict calitate cod

**Meșteșug decent, livrare inacceptabilă ca „produs finit".** Per-fișier, codul e peste
media livrărilor de agenție: TypeScript strict aproape fără cast-uri, parsare defensivă a
storage-ului, module pure curate (`nnNoteLayout`, `nnDashboardNotes`, `pendingNavigation`),
comentarii JSDoc utile, formatare impusă automat. `typecheck` și `lint` trec curat.

Ce trage în jos: **zero teste** (cel mai mare multiplicator de cost pentru orice lucrare
viitoare), numele mincinos „sync" în tot stratul de date, funcționalități documentate dar
nelegate, fișiere supradimensionate (834 / 690 / 558 linii) cu logică de domeniu și storage
în componente de prezentare, duplicare (3× `trimTrailingSlash`, 3 normalizatoare de URL cu
semantici subtil diferite), erori înghițite peste tot și identitatea de produs greșită în
metadate. Per ansamblu: un **snapshot de mijloc de dezvoltare**, nu o predare.

---

## 7. Plan de remediere recomandat (ordonat) + efort estimativ

Estimările sunt brute (zile-om), pentru un developer familiarizat cu extensii Chrome,
și presupun verificare manuală în browser (nu există teste). Ordinea reflectă
valoare/deblocare, nu doar severitate.

| # | Lucrare | Detaliu | Efort estimat |
|---|---|---|---|
| 1 | **Igienă de mediu + rebuild corect** | `.env` cu ID ExtensionPay real + `VITE_TRIAL_MODE=prod`, documentarea ambelor variabile în `.env.example`, rebuild, verificare trial 7 zile + buton BUY. **Doar configurare** — codul de plată rămâne neatins (off-limits). Cere cont ExtensionPay (decizie business). | 0,5 zile |
| 2 | **Refacerea dimensionării responsive** (mandatul principal) | Strategie de lățime a panoului relativă la viewport (cu clamp min/max), scară-rădăcină explicită în iframe, înlocuirea constantelor px cuplate cu rem, breakpoint-uri interioare, migrarea valorilor px persistate (`gapBeforePxByNoteId`), matrice de QA vizual (1366×768, 1920 @100/125/150%, HiDPI @200%, font Chrome mărit). Atinge ~13 fișiere; în `App.tsx`/`DashboardHeader.tsx`/`PaywallDialog.tsx` trebuie evitate liniile de plată. | 4–6 zile |
| 3 | **Sanitizarea HTML-ului notelor** | DOMPurify (sau echivalent) la salvare și/sau randare + interceptarea paste-ului către un subset sigur (b/i/u/br/p). Închide vectorul XSS stocat. | 1 zi |
| 4 | **Corectarea grupului „This Tab Notes"** | Decizie de produs (pe ce operează?) + rewire/redenumire. | 0,5 zile |
| 5 | **Persistarea tab-ului per URL** | Stratul de storage există deja; de legat în `useNNDashboardSession`. | 0,5–1 zi |
| 6 | **Identitate produs** | Descriere manifest, nume pachet, README rescris, ștergerea căii moarte `OPEN_SCROLL_BOOKMARK` + tipuri aferente. | 0,5 zile |
| 7 | **Funcționalități lipsă din design** | (a) câmp „price" — schemă + migrare + UI: 1–2 zile; (b) feedback vizual / rollout bară A–Z: 0,5–1 zi; (c) reordonare tab-uri prin drag — cere decizie de design (azi sortarea e alfabetică forțată): 1–2 zile dacă se dorește. | 2,5–5 zile |
| 8 | **Performanță scrieri** | Debounce la persistarea heading/body, eliminarea dublei re-citiri complete, scoaterea react-query (nefolosit) din bundle. | 1 zi |
| 9 | **Curățenie permisiuni + bundle** | Eliminare `tabs`/`activeTab` (cu retest), font auto-găzduit în loc de Google Fonts, inventarul de cod mort. | 0,5–1 zi |
| 10 | **Plasă de siguranță minimă** | Teste unitare pe logica pură (migrări storage, `resolveNoteListLayout`, normalizatoare URL) + logging minimal la erori de storage. | 1,5–2 zile |

**Total orientativ: ~12–18 zile-om** pentru tot; **primele 3 puncte (~6–8 zile) aduc
produsul la „lansabil"** (dimensionare corectă + plăți funcționale + gaură de securitate
închisă). Punctele 4–10 pot fi cotate separat.

**Zonă interzisă pentru orice lucrare viitoare:** logica de plată ExtPay + Stripe, logica
de trial/cumpărare și legarea butonului de plată — fișierele și liniile exacte sunt
cartografiate în `AGENTS.md` §7. Atenție specială: `App.tsx` și `DashboardHeader.tsx`
conțin simultan layout (permis) și trial wiring (interzis).

---

*Fișiere create în această evaluare: `AGENTS.md`, `ASSESSMENT_BRIEF_RO.md`. Niciun alt
fișier nu a fost modificat; nicio comandă git nu a fost rulată.*

---

## 8. Actualizare 2026-06-18 (Sprint 1) — ce s-a făcut, ce a rămas

Lucrări livrate după evaluarea de bază (commit-uri „Sprint 1"). `typecheck`/`lint`/`build`
trec curat. Maparea pe planul de remediere din §7:

**Rezolvat / livrat:**

- **#2 dimensionare responsive — NUCLEUL livrat.** `content.ts` calculează acum o lățime de
  panou proporțională cu viewport-ul (`panelWidth = viewportWidth × 686/REFERENCE_VIEWPORT`,
  cu clamp) și setează un „buton" de font-rădăcină pe iframe
  (`rootFontPx = panelWidth/686 × 16`), resincronizate la fiecare `visualViewport.resize` —
  deci lungimile rem scalează cu panoul. Grilă `--air-cell: calc(100vh/26)` pentru bara A–Z,
  „+", tab-uri (3 celule) și cele două bare de header (1 celulă fiecare). Cauza principală din
  §3 (panou fără logică de lățime, ~758px constant) e **eliminată**. RĂMÂNE: constantele px
  care nu „călăresc" knob-ul, migrarea `gapBeforePxByNoteId` din storage, matricea completă de
  QA (1366×768 / 1920@100-150% / HiDPI@200% / font Chrome mărit).
- **#3 sanitizare HTML — COMPLET.** `src/lib/sanitizeNoteHtml.ts` (allowlist pe DOMParser),
  aplicată la render/emit/format/paste în `RichTextBodyEditor.tsx`. Vectorul XSS stocat e închis.
- **#5 persistare per-URL — pare LEGATĂ** (de confirmat la runtime): `pageSession`/
  `patchSession` sunt folosite acum în `App.tsx` + `useNNDashboardSession` (la bază aveau zero
  apelanți).
- **#6 identitate — COMPLET.** `name`/`description` din manifest, numele din `package.json` și
  **README-ul rescris** descriu acum „Notes for Net"; cod mort starter șters
  (`OPEN_SCROLL_BOOKMARK`, `types/bookmark.ts`). (A rămas doar numele intern al elementului-host
  `#nn-scroll-bookmarks-overlay-host` — funcțional, intern, neredenumit ca să nu rupă stilarea
  scoped pe acel ID; redenumire opțională, low-priority.)
- **#9 permisiuni — parțial.** Reduse la `storage`/`scripting`/`unlimitedStorage`
  (`tabs`+`activeTab` eliminate); `<all_urls>` păstrat. RĂMÂNE: font auto-găzduit (încă Google
  Fonts la runtime) + scoaterea react-query nefolosit din bundle.
- **#1 — doar documentația.** `VITE_TRIAL_MODE` e documentat acum în `.env.example`; rebuild-ul
  plătit real (ID ExtPay + trial prod) rămâne sarcină de configurare a omului — cod OFF-LIMITS.
- **Fidelitate design (această sesiune):** header refăcut după `css.txt` (umbră, fundal gri nav,
  borduri albe 3px, DELETE TAB + NN ca o unitate lipită, înălțimi uniforme de 1 celulă, gutter
  alb dreapta ca logo-ul să nu intre sub scrollbar-ul browser-ului), feedback vizual A–Z (litera
  activă se evidențiază — repară §4.2), aliniere prin snap a ultimului tab subiect la baza
  derulării, DnD note cu un singur model de separare + fix „cursor-stick", overflow la modalul de
  ștergere, a11y dialoguri, re-injectare content script în dev, suprimarea erorilor `npm run dev`.

**Deschis (rămas de făcut):**

- **#1** rebuild plătit corect (om / configurare).
- **#2** coada de dimensionare (constante px rămase, migrare gap-uri persistate, QA pe rezoluții).
- **#4** grupul „This Tab Notes" (Min/Max/Delete) — semantică/etichetare de clarificat.
- **#7** funcționalitate de design lipsă: **câmp „price"** în header-ul notei (zero cod).
  (Reordonarea tab-urilor prin drag — §4.3 #3 — **nu a fost cerută niciodată**; nu e un gol de
  urmărit, scoasă din scope.)
- **#8** debounce la scrierile per-tastă + eliminarea dublei re-citiri complete.
- **#9** font auto-găzduit + scoaterea react-query din bundle.
- **#10** plasă minimă de teste + logging la erori de storage.

**Stadiu față de design/docs:** comportamentele de bază (tab-uri, note, rich text,
LINK/ANCHOR/COPY/PASTE, DnD, persistență, A–Z) sunt implementate și acum aliniate vizual la
`css.txt` / `docs/`. Singurul gol de design rămas este **câmpul „price"**; restul listei de mai sus este remediere
de calitate (#1, coada lui #2, #4, #8–#10), nu fidelitate de design.

*Modificat în această sesiune: cod sursă (commit-urile „Sprint 1") + acest addendum + `AGENTS.md` §10.*
