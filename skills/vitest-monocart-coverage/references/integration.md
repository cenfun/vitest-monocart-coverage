# Installation and integration

## Dependency model

`vitest-monocart-coverage@5.x` is a Vitest 5 custom coverage provider:

- `vitest` supplies the test/coverage lifecycle.
- `@vitest/coverage-v8` is a runtime dependency of this package and supplies the official V8 collection provider/runtime. Keep it on the same compatible version as `vitest`.
- `monocart-coverage-reports@3.x` turns the collected raw V8 data into reports.
- Browser mode additionally needs `@vitest/browser` and a browser provider such as `@vitest/browser-playwright`.

The provider does not replace Vitest, does not instrument source code, and does not make Istanbul input available. This skill supports `vitest-monocart-coverage` 5.x and later only; older package lines are not supported.

## Node integration

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

Package resolution uses the `node` export condition, which loads `lib/index.js` and then the provider.

Run:

```sh
npx vitest run --coverage
# or the host's existing test script:
npx vitest run -c vitest.config.js --coverage
```

Vitest starts/stops collection around the test run. The provider reads the file-based V8 coverage data written by the official V8 runtime, adds source/sourcemap information, and sends the raw entries to Monocart.

## Browser integration

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

Install browser packages separately when absent:

```sh
npm install --save-dev @vitest/browser @vitest/browser-playwright
npx playwright install chromium
```

The `browser` export is a thin runtime module. It triggers the official `@vitest/coverage-v8` browser commands registered by the provider (`__vitest_startV8Coverage`, `__vitest_takeV8Coverage`, `__vitest_stopV8Coverage`) and writes coverage files for the provider to read. Do not reimplement CDP collection in the host project.

Use `vitest-monocart-coverage/browser`, not the Node entry, for browser mode. Using the Node entry in browser mode prevents browser coverage collection.

## Where Monocart options come from

The provider supports three forms:

### 1. Discovered config file (recommended)

Create `mcr.config.js`, `mcr.config.mjs`, `mcr.config.cjs`, `mcr.config.json`, or a supported TypeScript config in the host project. Monocart discovers it from the working directory and its parents.

```js
// mcr.config.js
export default {
    name: 'Application Coverage',
    outputDir: 'coverage',
    reports: ['console-details', 'v8'],
    lcov: true
};
```

### 2. Explicit config path

```js
coverage: {
    enabled: true,
    provider: 'custom',
    customProviderModule: 'vitest-monocart-coverage',
    coverageReportOptions: './config/mcr.config.js'
}
```

Passing a string path makes the provider call `coverageReport.loadConfig(path)`.

### 3. Inline options object

```js
coverage: {
    enabled: true,
    provider: 'custom',
    customProviderModule: 'vitest-monocart-coverage',
    coverageReportOptions: {
        outputDir: 'coverage',
        reports: ['console-details', 'v8'],
        lcov: true
    }
}
```

An inline object is removed from the Vitest coverage config before Vitest resolves it and is passed to `new CoverageReport(options)`.

`coverageReportOptions` is a provider extension, not part of Vitest's public `CoverageOptions` type. In JavaScript it works as shown. In TypeScript, prefer a config file, augment the type locally, or use an explicit cast instead of assuming Vitest declares this field.

## Vitest options that still matter

| Option | Effect with this provider |
| --- | --- |
| `coverage.enabled` | Enables collection and this provider. |
| `coverage.provider: 'custom'` | Required. The provider switches the runtime to official V8 internally. |
| `coverage.customProviderModule` | Node: package name. Browser: `/browser` entry. |
| `coverage.include` / `exclude` | Used by Vitest's official coverage map and thresholds. They do **not** automatically define Monocart's final file list. |
| `coverage.thresholds` | Supported through the official Istanbul coverage map. Enabling thresholds adds official V8-to-Istanbul conversion work. |
| `coverage.reportsDirectory` | Vitest temporary coverage directory, including `.tmp`. Not the final Monocart report directory. |
| `coverage.reporter` | Overridden to `['none']`. Configure report formats in Monocart instead. |
| `coverage.clean` | Vitest directory cleanup. Separate from Monocart `clean`/`cleanCache`. |

## Recommended first configuration

Start with a narrow report scope and two outputs: a terminal summary and an interactive V8 report.

```js
// mcr.config.js
export default {
    name: 'Vitest Coverage',
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

After the first successful run, decide whether to add `outputFilter`, untested files (`all`), or other report formats. Do not add both input and output filtering by default. See [configuration.md](configuration.md).

## Thresholds

Vitest thresholds are evaluated by the official coverage map:

```js
coverage: {
    enabled: true,
    provider: 'custom',
    customProviderModule: 'vitest-monocart-coverage',
    include: ['src/**'],
    thresholds: {
        lines: 80,
        branches: 70
    }
}
```

Important consequences:

- The provider only runs the official V8-to-Istanbul conversion when thresholds are configured.
- Monocart still generates its own report from raw V8 data.
- Vitest thresholds obey `coverage.include`/`exclude`; Monocart obeys its own filters.
- If the two scopes differ, a passing Monocart report and a failing threshold result (or vice versa) can both be correct.
- Do not use Monocart `watermarks` as a CI threshold. They only affect colors.

Test both a passing and a failing threshold run when changing this behavior.

## Sharding, watch mode, and repeated runs

- Give each independent Vitest process a unique Monocart `outputDir` unless the workflow explicitly coordinates a shared cache.
- Do not let multiple workers generate/clean the same Monocart output concurrently.
- Vitest may delete its own `.tmp` coverage directory during cleanup; the provider tolerates that after reading the data.
- For merged reports across shards/jobs, prefer Monocart raw exports and pass the resulting raw directories through MCR `inputDir`; do not average rendered reports.
- In watch mode, confirm that the report reflects the latest run and that stale files are not being mistaken for current coverage.

For detailed Monocart report/merge behavior, use the Monocart coverage reports documentation/skill as the authority.
