# Repository architecture and maintenance

This reference is for changing `vitest-monocart-coverage` itself, not for ordinary host-project setup.

## Supported line

This repository supports `vitest-monocart-coverage` 5.x and later only.

- Vitest 5.x
- `monocart-coverage-reports` 3.x
- Node.js `>=22.15.0`
- V8 coverage only

The provider relies on Vitest 5's file-based V8 coverage data and official browser coverage commands. Older package lines are not supported by this skill.

## Repository map

| Area | Files |
| --- | --- |
| Node provider module | `lib/index.js`, `lib/load-provider.js` |
| Provider implementation | `lib/provider.js` |
| Browser provider/runtime module | `lib/browser.js` |
| Public types | `lib/index.d.ts` |
| Example coverage config | `mcr.config.js` |
| Node test config | `vitest.config.js` |
| Browser test config | `vitest.browser.config.js` |
| Fixtures | `src/`, `test/` |
| Package exports/files and versions | `package.json` |
| User documentation | `README.md`, `CHANGELOG.md` |

The npm package ships `lib/` and `skills/`. It does not ship the repository's test fixtures.

## Current provider architecture

### 1. Module loading

- `lib/index.js` exports the custom provider module with `getProvider()` for Node.
- `lib/load-provider.js` lazily imports `provider.js` and constructs `MonocartProvider`.
- `lib/browser.js` is the browser `customProviderModule` entry. It triggers official Vitest V8 browser commands and also returns the provider via `getProvider()`.

### 2. Official V8 provider reuse

`lib/provider.js` extends the official Vitest V8 provider rather than reimplementing collection:

```js
import coverageV8 from '@vitest/coverage-v8';

const V8CoverageProvider = (await coverageV8.getProvider()).constructor;
```

The official provider class is not a public named export of `@vitest/coverage-v8`; it is obtained from the official `getProvider()` result. Reusing it provides:

- `BaseCoverageProvider._initialize()`
- Vitest 5 file-based coverage reading
- browser coverage command registration
- `autoAttachSubprocess` support
- official URL normalization, source lookup, and threshold conversion when needed

Keep the comment in the source explaining this. If Vitest changes the official provider contract, update this seam deliberately and validate Node and browser paths.

### 3. Initialization

`MonocartProvider.initialize(ctx)`:

1. Sets `this.version = ctx.version` to avoid mixed-version warnings in this compatibility shim.
2. Calls `super.initialize(ctx)` to reuse official setup and browser command registration.
3. Loads Monocart options from `coverageReportOptions` or `mcr.config.*`.
4. Sets options:
    - Node: `provider: 'v8'`
    - Browser: `provider: 'custom'`
    - `reporter: ['none']` so Vitest does not generate its own reports
5. Updates `ctx.config.coverage.provider` accordingly.

The user-facing config remains `provider: 'custom'` with a `customProviderModule`. The internal switch selects the collection runtime.

### 4. Raw V8 data collection

`readCoverageFiles()` wraps the official reader:

- Calls the original `onFileRead`/`onFinished` callbacks.
- Captures cloned raw V8 entries for Monocart.
- Enriches entries with transformed `source` and `sourceMap`.
- Adds them to the Monocart report.

Important invariants:

- **Do not mutate the official coverage entry objects.** Clone them before changing URLs or adding source fields. The official provider uses the originals for its own conversion.
- **Do not mutate a shared sourcemap object.** Clone the map when replacing `sources`; Vitest/Vite may return the same cached map object used by official conversion.
- Keep `entry.startOffset` handling. V8 offsets refer to executed/transformed code; the module-runner wrapper length must be applied.
- Normalize browser URLs to file URLs only in the Monocart copy.
- Decode percent-encoded query URLs before source path resolution.

### 5. Coverage generation and reports

`generateCoverage()` has two paths:

- **No Vitest thresholds:** read the official coverage files and feed raw V8 entries to Monocart without V8-to-Istanbul conversion. Return an empty result object because Monocart handles the report.
- **Thresholds enabled:** call the official `generateCoverage()` so Vitest receives an Istanbul coverage map for `reportThresholds()`. The raw entries are still sent to Monocart through the overridden reader.

`generateReports()`:

1. Calls the Monocart report `generate()`.
2. Calls the inherited `reportThresholds()` when configured.

This intentionally allows Monocart and Vitest thresholds to use different file scopes. Document that distinction instead of silently aligning them.

### 6. Cleanup

Monocart may clean its `outputDir`, which can contain Vitest's temporary `.tmp` coverage directory. The provider's `cleanAfterRun()` therefore:

- Resets `coverageFiles`.
- Force-removes the Vitest coverage files directory.
- Releases `reportsDirectoryLock`.

Keep the lock release. Removing it can leave later watch/rerun sessions locked.

## Changing behavior safely

When changing public behavior, update all applicable places:

1. `lib/provider.js` / `lib/browser.js` / `lib/load-provider.js`
2. `package.json` dependencies, exports, files, engines
3. `lib/index.d.ts` if public types change
4. `README.md`
5. `CHANGELOG.md`
6. This skill and its references
7. Focused tests/configs under `test/`, `src/`, or temporary validation projects

Do not change only the provider code when the user-facing config contract changes.

## Validation commands

From the repository root, after installing dependencies:

```sh
npm test
npm run test:browser
npx eslint lib mcr.config.js vitest.config.js vitest.browser.config.js
npm pack --dry-run
```

There is no dedicated lint script in `package.json`; invoke ESLint as above or use the project's current lint command if one is added later.

Browser tests need a Playwright browser binary:

```sh
npx playwright install chromium
```

For a threshold change, create a temporary Vitest config with `coverage.thresholds` and verify:

- Monocart report is still generated.
- Vitest emits the expected threshold error.
- The process exits nonzero.
- Raw V8 path and official conversion path both behave correctly.

For packaging changes, also do a consumer smoke test:

```sh
npm pack
# install the tarball into a temporary project with vitest@5
# run a small Node coverage test and, if changed, a browser coverage test
```

Remove the tarball and temporary consumer afterward.

## Packaging the skill

The repository-level skill lives at:

```text
skills/vitest-monocart-coverage/
├── SKILL.md
└── references/
```

To distribute it through npm, `package.json` must include it:

```json
{
    "files": ["lib", "skills"],
    "exports": {
        "./skills/*": "./skills/*"
    }
}
```

Then verify:

```sh
npm pack --dry-run
node -p "require.resolve('vitest-monocart-coverage/skills/vitest-monocart-coverage/SKILL.md')"
```

The second command is meaningful from an installed/consumer project. From the repository itself, inspect the packed file list.

Skill maintenance checklist:

- [ ] Frontmatter `name` matches the directory (`vitest-monocart-coverage`).
- [ ] `description` states what the skill does and when it applies.
- [ ] Relative links resolve.
- [ ] `npm pack` includes `SKILL.md` and every reference.
- [ ] Package-only commands resolve the installed `SKILL.md`.
- [ ] Examples match the current Vitest/MCR versions.
- [ ] No references to unpublished or removed APIs.

## Provider-specific regression checks

At minimum, cover these paths when touching the provider:

- Node collection with no thresholds (native V8 → Monocart).
- Node collection with thresholds (official map + Monocart report).
- Browser collection through `/browser`.
- Browser packages missing/mismatched should produce a clear failure, not silent success.
- `coverageReportOptions` as an object and as a config path.
- Query-suffixed modules such as `?raw`.
- Windows and POSIX path handling.
- Empty test runs and invalid/missing coverage output.
- `npm pack` consumer install for both Node and browser entries.

Do not claim a browser path is validated from Node results alone.
