# Troubleshooting

Diagnose in this order: host versions → provider selection → collection lifecycle → Monocart options → file scope → sourcemaps → thresholds/CI. Do not change provider internals until the basic integration is verified.

## Quick symptom table

| Symptom | Likely cause | First check |
| --- | --- | --- |
| `[MCR] Not found coverage data in dir(s):` | No V8 coverage files were produced or read | Is the custom provider actually active? Did tests run? Are Vitest/browser versions compatible? |
| Report contains test files or `node_modules` | Monocart filters missing; Vitest `include` does not define MCR scope | Configure MCR `entryFilter`/`sourceFilter`/`outputFilter` |
| Report is empty but tests passed | Collection started too late, wrong provider entry, or filters excluded everything | Inspect raw entry URLs and temporary coverage files |
| Browser run has no coverage | Browser entry not used, browser packages missing/mismatched, or browser not enabled | Use `vitest-monocart-coverage/browser`, install `@vitest/browser*` |
| `Coverage enabled with monocart` but no files | No tests collected, no sourcemap match, or output inspected at wrong path | Check test include/globs and Monocart `outputDir` |
| Thresholds pass/fail differently from the MCR report | Monocart scope and Vitest `include`/`exclude` differ | Align both scopes or document the difference |
| LCOV/HTML not produced | Reports configured in `coverage.reporter` instead of Monocart | Configure MCR `reports`/`lcov` |
| `require is not defined` / ESM error in MCR config | MCR 3.x is ESM-only | Use ESM config or `mcr.config.cjs`; use async `import()` in CJS |
| Mixed Vitest/coverage version warning | Mismatched Vitest ecosystem packages | Align `vitest`, `@vitest/coverage-v8`, `@vitest/browser*` |
| Node engine error | Node.js is older than `22.15.0` | Upgrade Node.js; older runtimes are unsupported |
| `coverageReportOptions` TypeScript error | Provider extension is not in Vitest's public type | Use a config file/string or an explicit cast |
| Report shows `?raw`/query-suffixed files | Resource-query module paths not normalized | Add Monocart `sourcePath` handling |
| Report paths point at the wrong directory | Monocart `outputDir` confused with Vitest `reportsDirectory` | Read the generated path from MCR options/output |

## 1. Confirm the provider is active

Vitest should log:

```text
Coverage enabled with monocart
```

If it logs `v8`, `istanbul`, or no coverage provider:

- `coverage.enabled` must be true.
- `coverage.provider` must be `custom`.
- `coverage.customProviderModule` must be exactly:
    - Node: `vitest-monocart-coverage`
    - Browser: `vitest-monocart-coverage/browser`
- The package must be installed in the host project, not only in a parent monorepo root.
- In a monorepo, confirm the project/workspace config actually extends the intended coverage config.

Do not set `coverage.provider: 'v8'` while expecting Monocart reports. The provider internally switches the runtime to official V8, but the user-facing provider must remain `custom`.

## 2. Verify tests and collection lifecycle

- Run a single representative test file first.
- Confirm the test file is included by Vitest's `test.include`/project config and actually executes.
- Do not wrap Vitest so that coverage starts after test imports.
- For browser tests, confirm the page navigates/loads the code under test before the run ends.
- A test suite with zero tests can legitimately produce no coverage; do not treat an empty run as a provider failure.

If tests fail, Vitest may still report coverage depending on `coverage.reportOnFailure`. Reproduce with a passing test before debugging report generation.

## 3. Inspect raw data before filtering

Temporarily broaden Monocart filters:

```js
// mcr.config.js
export default {
    logging: 'debug',
    reports: ['console-details', 'v8'],
    outputDir: 'coverage-debug',
    entryFilter: {
        '*': true
    }
};
```

Then inspect:

- Which entry URLs/paths appear?
- Are the expected source files present?
- Are URLs file paths, Vite virtual URLs, `?raw`/query URLs, or browser-relative URLs?
- Do sourcemaps point to the tested build?

Once the expected entries appear, tighten the MCR filter. Do not keep a permissive filter in final CI.

If enabling `logging: 'debug'` retains sensitive source/cache artifacts, remove them before publishing/uploading.

## 4. Missing coverage data

`Not found coverage data` means Monocart received no usable V8 entries.

Check, in order:

1. The custom provider is active (section 1).
2. Tests actually ran and imported the intended code.
3. The host uses Vitest 5 with this package's 5.x line.
4. `@vitest/coverage-v8` resolves to a compatible version.
5. In browser mode, `@vitest/browser` and the browser provider are installed and the configured browser launches.
6. Monocart filters are not excluding every entry.
7. The final report is being read from the Monocart `outputDir`, not a stale `reportsDirectory`.

Do not “fix” this by fabricating source strings or coverage counts. The issue is collection or filtering.

## 5. Browser-specific failures

- Using `vitest-monocart-coverage` instead of `vitest-monocart-coverage/browser` prevents browser collection.
- `@vitest/browser` must match the Vitest version. Align all `@vitest/*` packages.
- Playwright users must install a browser binary, for example `npx playwright install chromium`.
- Confirm `test.browser.enabled` is true and the coverage config is on the same project.
- Browser coverage here is JavaScript V8 coverage; CSS coverage is not provided by this package.
- If browser tests run in multiple instances/projects, verify each project's coverage config and output path. Do not let concurrent projects clean the same output directory.
- If the provider was upgraded independently, the browser runtime and registered V8 command names may not match. Align the package versions.

## 6. Report formats and output paths

- `test.coverage.reporter` is forced to `none` by the provider. Configure `reports`, `lcov`, `outputDir`, and related output in Monocart.
- `coverage.reportsDirectory` is Vitest's temporary coverage directory, commonly containing `.tmp`. It is not the final Monocart report directory.
- Read `outputDir` from the active `mcr.config.*` or inline `coverageReportOptions`.
- Use a dedicated output directory. Vitest rejects `reportsDirectory` values equal to the project root or current working directory.
- If a report file is missing, check whether Monocart returned early because no data was collected. Old reports may remain from previous runs; validate a fresh nonempty result.

## 7. Incorrect file scope

The MCR report is built from raw V8 entries and its own filters:

- Vitest `coverage.include`/`exclude` are not a substitute for Monocart `entryFilter`/`sourceFilter`/`outputFilter`.
- `sourceFilter` does not remove unmapped entries that lack sourcemaps.
- Ordered filter objects use first-match-wins; a broad exclude can remove everything.
- Glob patterns may not include dot-prefixed directories unless explicitly matched.
- `outputFilter` cannot restore entries excluded earlier.
- `all` is required for never-imported files; Vitest `coverage.include` does not automatically add them to the Monocart report.

When both the MCR report and Vitest thresholds are used, explicitly compare their file scopes. A mismatch is a configuration issue, not automatically a coverage bug.

## 8. Sourcemap and path problems

- Ensure sourcemaps are produced for the exact build Vitest transforms/executes.
- Use MCR `logging: 'debug'` and inspect mapped source paths for a representative file.
- Do not use maps from a different build revision.
- For query-suffixed modules (`?raw`, `?import`, etc.), normalize paths in Monocart `sourcePath`:

```js
sourcePath: (filePath) => filePath.split('?').shift()
```

- For monorepos or different collection/report working directories, set a shared `baseDir` or a deliberate `sourcePath` rewrite.
- Do not collapse all files to basenames; collisions produce misleading reports.
- Windows path separators should be normalized consistently before comparison or merging.

## 9. Thresholds

Vitest `coverage.thresholds` uses the official Istanbul coverage map, not Monocart's result:

- `coverage.include`/`exclude` affect thresholds.
- Monocart filters affect the MCR report.
- Enabling thresholds adds official V8-to-Istanbul conversion work.
- If thresholds fail unexpectedly, inspect the official file list and the mapped lines for the failing file.
- If MCR report generation fails only when thresholds are enabled, isolate whether the failure is in the official conversion or the Monocart report. Removing thresholds temporarily is a diagnostic step, not a permanent fix.
- MCR `watermarks` do not enforce thresholds.

## 10. Version and module-format errors

### Node runtime

This 5.x line requires Node.js `>=22.15.0`. Older Node.js runtimes are unsupported. Do not upgrade the host runtime as an incidental fix; confirm with the user/CI policy.

### ESM and CommonJS

- MCR 3.x is ESM-only.
- `mcr.config.cjs` remains valid for config.
- Replace `require('monocart-coverage-reports')` with ESM import or async `import()`.
- Do not add `"type": "module"` to an entire host project just to satisfy one config file.
- TypeScript configs need a loader such as `tsx` when the host uses one.

### Mixed versions

Keep these aligned with the installed Vitest:

- `vitest`
- `@vitest/coverage-v8`
- `@vitest/browser`
- `@vitest/browser-playwright` (or the chosen browser provider)

If a mixed-version warning appears, fix dependency alignment before debugging coverage behavior.

## 11. `coverageReportOptions` TypeScript error

`coverageReportOptions` is provided by this package, not declared in Vitest's public `CoverageOptions` type. Options:

1. Prefer a discovered `mcr.config.js` or an explicit config path string.
2. Augment the local Vitest type in the host project.
3. Use a documented local cast at the config boundary.

Do not silence unrelated type errors across the whole coverage config.

## 12. Stale reports and CI false positives

- A previous report can survive a failed/empty new run. Validate a fresh output directory or a newly generated machine-readable file with nonempty metrics.
- Do not rely only on “file exists” checks.
- Preserve failing test exit codes.
- Upload coverage artifacts even when tests fail, but do not mark the job successful because an artifact was uploaded.
- Keep raw inputs until merge validation passes.

## 13. When to inspect provider source

Inspect the repository only after confirming host integration and configuration. Start with `lib/provider.js`, `lib/browser.js`, and `lib/load-provider.js`. See [maintenance.md](maintenance.md).

Do not patch `node_modules`, hide data by editing counts, or replace the provider with a fabricated fallback implementation. Reproduce the failing path with a focused test first.
