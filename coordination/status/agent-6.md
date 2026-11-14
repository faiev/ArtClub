# Status — Agent 6: Editing safety

- **Overall status:** REVIEW — AC-015/055/056/059/060/092 are merged. AC-057 (#29) is open, non-draft and mergeable with the post-UI-01 audit addendum. AC-058 (#40) is open/draft and mergeable; exact-head run #43634148775 passed 247 Node tests plus standard Chromium editor E2E, GIF raster and MCP checks. The dedicated standalone safety runner is still not invoked by CI.
- **Current work:** refreshed AC-057 against the post-UI-01 production source; improved AC-058 runner discovery to use Playwright's installed Chromium automatically (with `CHROMIUM_PATH` and system fallbacks); added two deterministic path-selection tests; synchronized both branches to main snapshot `5d3628526cbe2e6905a00c81106f036aa9581928`; verified exact-head CI run #43634148775. Coordinator handoff comment #6882986054 requests the one-line standalone-runner invocation. UI-02 PR search returns no open match. No new feature phase is assigned.
- **Active branches/heads:** `agent/safe-edit-path-audit` / `293c8bb42ad77cba813903f0a2580add2b66d1ae` (AC-057); `agent/layer-safety-browser` / `42272ec110ddf04a4ef5d1caa6b7804acfebf1fd` (AC-058). Both were synced non-force to main snapshot `5d3628526cbe2e6905a00c81106f036aa9581928`; compare shows 0 commits behind and unchanged assigned file scopes.
- **Coordination source:** `main` at sync snapshot `5d3628526cbe2e6905a00c81106f036aa9581928` (2026-11-15). Both branches were 0 commits behind immediately after sync; GitHub reports both PRs mergeable and their PR changed-file scopes remain clean.
- **Production integration boundary:** coordinator remains sole writer of `index.html`, production UI and workflow files. Agent 6 has reviewer responsibility for UI-02 only; no UI-02 PR is currently open.

## Delivered phases and merge ledger

| Phase | PR | Result |
|---|---|---|
| AC-015 | [#14](https://github.com/faiev/ArtClub/pull/14) | Merged as `b53708dd73a4a0d00a7fdd2c79048054a2024295`. Pre-merge run #43613631801: 84 Node tests; standard Chromium editor E2E, GIF full-raster and MCP checks passed. |
| AC-055 | [#23](https://github.com/faiev/ArtClub/pull/23) | Merged as `8ae25528af84c8fa4808ad375e4053e0f934eb14`. Run #43614462471: 121 Node tests; standard Chromium, GIF and MCP passed. |
| AC-056 | [#26](https://github.com/faiev/ArtClub/pull/26) | Merged as `fc0c36e8e59108f21a9bb90886d053d6dfe02153`. Run #43614484842: 134 Node tests; standard Chromium, GIF and MCP passed. |
| AC-057 | [#29](https://github.com/faiev/ArtClub/pull/29) | Open, non-draft, mergeable; head `293c8bb42ad77cba813903f0a2580add2b66d1ae`. Synced to main `5d3628526cbe2e6905a00c81106f036aa9581928`; 14 commits ahead / 0 behind; only `docs/SAFE_EDIT_PATH_AUDIT.md` differs, including post-UI-01 source revalidation. |
| AC-058 | [#40](https://github.com/faiev/ArtClub/pull/40) | Open, draft, mergeable; head `42272ec110ddf04a4ef5d1caa6b7804acfebf1fd`. Synced to main `5d3628526cbe2e6905a00c81106f036aa9581928`; 25 commits ahead / 0 behind; four assigned harness/docs files only. Exact-head run #43634148775 passed 247 Node tests, standard Chromium editor E2E, GIF full-raster and MCP E2E. |
| AC-059 | [#48](https://github.com/faiev/ArtClub/pull/48) | Merged as `103b5c488c262a0c34807d38361f193895e1e7db`. Run #43614528692: 152 Node tests; standard Chromium, GIF and MCP passed. |
| AC-060 | [#49](https://github.com/faiev/ArtClub/pull/49) | Merged as `87c15b08d41653e255922e3961698608ab991708`. Documentation-only integration contract; no live UI/API wiring claimed. |
| AC-092 | [#62](https://github.com/faiev/ArtClub/pull/62) | Merged as `567c178df307b8332f6dd156b313021be77cf5f4`. Run #43614650497: 160 Node tests; standard Chromium editor E2E, GIF full-raster and MCP passed. |

## Remaining PR details

### AC-057 — PR #29

- The audit documents the current Toolbar Clear and asynchronous image-import bypasses, zero-opacity and optional-revision gaps, and proposed integration points.
- The PR changes only `docs/SAFE_EDIT_PATH_AUDIT.md`; no application behavior is claimed.
- The audit was refreshed after UI-01 merged. It revalidates production source blob `index.html` `4645281c1aad8580529e7feb99cd299a88543913` and records current exact locations: `isActiveLayerEditable()` at 830–833; selection clear at 1022–1029; selection paste at 1031–1046; toolbar Clear at 2246–2249; image import at 2310–2331. Toolbar Clear and async image-import commit still bypass the new guard/transaction modules. The PR remains docs-only and GitHub reports it mergeable. Coordinator review/merge is outstanding; Agent 6 has not merged it.
- No code or test changes are part of AC-057. Agent 6 has not merged it.

### AC-058 — PR #40

- Retargeted from the now-merged PR #26 branch to `main`; current diff is exactly:
  - `docs/layer-edit-safety.md`
  - `tests/layer-safety.browser.html`
  - `tests/layer-safety.browser.mjs`
  - `tests/layer-safety.browser.test.js`
- After syncing to main snapshot `5d3628526cbe2e6905a00c81106f036aa9581928`, exact head `42272ec110ddf04a4ef5d1caa6b7804acfebf1fd` passed run #43634148775: Node **247 passed / 0 failed**, including all four harness parser/inventory tests and two Chromium-path discovery tests; standard Chromium editor E2E, GIF ImageDecoder full-raster and MCP E2E passed.
- The dedicated `node tests/layer-safety.browser.mjs` runner has not yet been executed by the shared workflow. In this shell, cloning the public repo failed DNS resolution and Chromium timed out even on minimal local HTML. Runner support now detects the Playwright-managed executable from `agent-bridge/node_modules/playwright` after the existing install step, so the coordinator can add the standalone command without a `CHROMIUM_PATH` setup. Agent 3 explicitly released the shared workflow lock on 2026-11-15, but Agent 6's assignment still excludes workflow edits. Handoff comment #6882986054 requests that one-line workflow step or explicit authorization. Standard editor E2E and Node parser tests do not satisfy the dedicated browser acceptance gate.
- PR remains draft and GitHub reports `mergeable: true`; the dedicated runner is still an explicit acceptance gate. No custom-browser pass is claimed. Do not edit the workflow without coordinator authorization.

## AC-092 conformance evidence

Files: `tests/safe-edit-conformance.test.js`, `docs/SAFE_EDIT_CONFORMANCE.md`.

Five fixed unsigned 32-bit seeds, bounded 1–8 px fixtures, 2–3 layers/frames and 16 iterations per seeded property. Eight property/sequence tests cover accept/deny paths, sparse/undefined/malformed pixels, stale revisions, complete input immutability, own-slot shape, derived raster, detached transactions, unrelated state preservation, deterministic replay, staging and composed operations.

Replay one seed with:

```sh
SAFE_EDIT_SEED=<unsigned-32-bit> node --test tests/safe-edit-conformance.test.js
```

Run #43614650497 on exact head `d3a674ba45e704cef7eb8a6e1d951804f4933518`: 160 Node tests passed; standard Chromium editor E2E, GIF ImageDecoder RGBA raster verification and MCP E2E passed. No runtime dependency or workflow change.

## Integration boundaries and ranked next actions

1. Keep PR #40 draft until `node tests/layer-safety.browser.mjs` passes in a working headless Chromium environment. The runner now auto-discovers Playwright Chromium after the existing install step; the shared workflow still needs this one-line invocation. Agent 6 has not changed the shared workflow because that file is outside its assignment.
2. Ask the coordinator to review/merge PR #29; the updated AC-057 audit is docs-only and GitHub currently reports it mergeable. Do not self-merge.
3. When coordinator-owned UI-02 opens, review Toolbar Clear, asynchronous import target capture/revalidation, selection paste/replace, revision checks, transaction atomicity, denial feedback and rollback/source immutability. Review only; do not edit production UI.
4. Re-run exact-head checks after any later branch synchronization and keep evidence tied to the tested SHA.
5. Do not edit `index.html`, production CSS, project model/storage, Agent API/bridge, exporter/renderer, another agent's tests or the shared workflow. Do not start AC-093; no Agent 6 phase beyond AC-092 is authorized.
- **Last updated:** 2026-11-15; main snapshot `5d3628526cbe2e6905a00c81106f036aa9581928`; exact-head PR #40 run #43634148775 verified. UI-02 PR search returned no open match.
