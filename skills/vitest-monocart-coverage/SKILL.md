---
name: vitest-monocart-coverage
description: Integrate, configure, debug, and maintain vitest-monocart-coverage 5.x or later, a Vitest 5 custom coverage provider that generates Monocart coverage reports from native V8 coverage. Use for Node.js and @vitest/browser coverage setup, customProviderModule and mcr.config/coverageReportOptions, V8 filters and source paths, coverage thresholds, troubleshooting missing or incorrect coverage, and repository maintenance. Also applies to Chinese requests about Vitest 覆盖率、Monocart 报告、V8 coverage、浏览器覆盖率、覆盖率配置和覆盖率排错.
---

# Coverage with Vitest Monocart Coverage

## Language, portability, and loading

- Follow the user's language for replies, generated comments, and report labels. Equivalent requests in any language activate the same workflow; exact English trigger words are not required.
- Use the host project's existing package manager, Vitest version, browser provider, and module conventions. This package is a **Vitest custom coverage provider**; it does not replace Vitest and does not instrument Istanbul code.
- Copy/distribute this entire directory, including `references/`. Resolve bundled links relative to this skill, not the working directory.
- The npm package includes the skill but does not register it with an agent automatically. From the **host project root**, locate it with:

```sh
node -p "require.resolve('vitest-monocart-coverage/skills/vitest-monocart-coverage/SKILL.md')"
node -p "require.resolve('vitest-monocart-coverage/package.json')"
```

Read the first file, then its relative references. Read the resolved manifest for the installed version, engines, exports, and dependencies. These commands resolve files; do not import Markdown as JavaScript. This skill supports the 5.x line and later only. Older package lines are not supported.

## Version requirement — check first

This skill targets **vitest-monocart-coverage 5.x and later** only. It does not document or support older package lines.

Current requirements:

- Vitest 5.x
- `monocart-coverage-reports` 3.x
- Node.js `>=22.15.0`
- V8 coverage only; Istanbul instrumentation input is not supported
- Browser mode: `@vitest/browser` plus a browser provider such as `@vitest/browser-playwright`

Keep `vitest`, `@vitest/coverage-v8`, and `@vitest/browser*` on compatible versions. This package depends on `@vitest/coverage-v8` and reuses the official V8 provider/runtime. `monocart-coverage-reports` is 3.x and native ESM. CommonJS config files remain supported as `mcr.config.cjs`, but `require('monocart-coverage-reports')` is not.

If the host does not meet these requirements, stop. Do not apply these instructions to an older stack and do not silently upgrade the host runtime during dependency work.

## Workflow and reference routing

1. Inspect the host `package.json`, lockfile, Vitest version, existing `coverage` config, browser setup, and CI commands.
2. Choose Node or browser integration from [integration.md](references/integration.md). Use the exact `customProviderModule` path: `vitest-monocart-coverage` for Node, `vitest-monocart-coverage/browser` for `@vitest/browser`.
3. Decide where Monocart options live: discovered `mcr.config.*`, an explicit config path, or inline `coverage.coverageReportOptions`. Read [configuration.md](references/configuration.md) for output paths, reports, filters, source paths, and thresholds.
4. Run a small representative test first. Inspect the file list, mapped paths, summaries, and report artifacts before tightening filters.
5. For missing, empty, duplicated, or incorrectly mapped coverage, use [troubleshooting.md](references/troubleshooting.md) before changing provider code.
6. For repository maintenance, official-provider reuse, tests, packaging, and release validation, read [maintenance.md](references/maintenance.md).

Do not load every reference by default. Read the one that matches the task.

## Quick start: Node

Install the provider as a development dependency:

```sh
npm install --save-dev vitest-monocart-coverage
```

Configure Vitest:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            enabled: true,
            provider: 'custom',
            customProviderModule: 'vitest-monocart-coverage'
        }
    }
});
```

Configure Monocart with a discovered config file:

```js
// mcr.config.js
export default {
    name: 'My Vitest Coverage Report',
    outputDir: 'coverage',
    reports: ['console-details', 'v8'],
    lcov: true,
    entryFilter: {
        '**/node_modules/**': false,
        '**/src/**': true
    },
    sourceFilter: {
        '**/node_modules/**': false,
        '**/src/**': true
    }
};
```

Run:

```sh
npx vitest run --coverage
```

The final HTML/report path comes from Monocart's `outputDir`; Vitest's `coverage.reportsDirectory` is used for temporary coverage files, not as the final Monocart report path.

## Quick start: Browser

Install the browser provider and its Playwright backend if missing:

```sh
npm install --save-dev @vitest/browser @vitest/browser-playwright
npx playwright install chromium
```

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
    test: {
        coverage: {
            enabled: true,
            provider: 'custom',
            customProviderModule: 'vitest-monocart-coverage/browser'
        },
        browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
            provider: playwright()
        }
    }
});
```

Browser coverage reuses the official Vitest V8 browser commands. Keep `@vitest/browser`, `@vitest/browser-playwright`, `vitest`, and `@vitest/coverage-v8` on compatible versions.

## Essential contracts and pitfalls

- **Vitest reporters are not Monocart reporters.** The provider forces Vitest's coverage reporter to `none`. Configure `reports`, `lcov`, `outputDir`, and related output in Monocart, not only in `coverage.reporter`.
- **MCR report scope is controlled by MCR filters.** Raw V8 entries are handed to Monocart; Vitest `coverage.include`/`exclude` do not automatically filter the final Monocart file list. Configure Monocart `entryFilter`/`sourceFilter`/`outputFilter` (or `all`) for the report. Vitest `include`/`exclude` still affect the official coverage map used by `coverage.thresholds`.
- **Thresholds use the official coverage map.** When `coverage.thresholds` is set, the provider additionally performs the official V8-to-Istanbul conversion needed by Vitest. The Monocart report and Vitest thresholds may therefore list different file scopes unless both are configured consistently.
- **`coverageReportOptions` is a provider extension.** It accepts either an options object or a config-file path. Prefer `mcr.config.*` for discoverability. TypeScript may reject the extra property because it is not part of Vitest's public `CoverageOptions` type; use a config file or an explicit cast if needed.
- **Do not disable collection at the wrong time.** Start coverage before importing/navigating to the code under test. Vitest manages this automatically; custom wrappers around Vitest must preserve it.
- **Do not treat empty output as success.** Validate that expected source files appear and that metrics are nonempty. MCR can report “Not found coverage data” when no usable entries were collected.
- **Keep cleanup paths separate.** Use a dedicated Monocart `outputDir`. Do not point it at source directories or share one output directory between concurrent Vitest processes.
- **Do not import package internals from the host project.** The supported integration points are the two `customProviderModule` entries and the Monocart options/config API.

## Delivery checklist

- [ ] Host Vitest, browser packages, `@vitest/coverage-v8`, and this package are on compatible lines.
- [ ] Node uses `vitest-monocart-coverage`; browser mode uses `vitest-monocart-coverage/browser`.
- [ ] Monocart options are configured once (config file or `coverageReportOptions`), with a dedicated `outputDir`.
- [ ] MCR filters select the intended source scope; test/dependency/generated files are excluded intentionally.
- [ ] Sourcemaps and source paths correspond to the code Vitest actually transformed/executed.
- [ ] If thresholds are used, verify both the threshold result and the Monocart report file scope.
- [ ] Empty/missing coverage fails visibly; stale reports are not mistaken for current results.
- [ ] Browser coverage was checked in the configured browser instance, not assumed from Node coverage.
- [ ] Report artifacts exist and the actual commands/validation results are reported in the user's language.

Deliver changed paths, commands, output locations, source-scope assumptions, and actual validation results.
