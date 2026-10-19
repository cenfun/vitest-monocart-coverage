# Monocart configuration for the Vitest provider

The provider collects **JavaScript V8 coverage** and hands raw V8 entries to Monocart. Report formatting and filtering are Monocart's job.

This package does not support Istanbul instrumentation as coverage input and does not collect CSS coverage. It passes raw V8 data to Monocart, which can still produce Istanbul-compatible reports such as `html`, `lcovonly`, or `cobertura` by converting that V8 data internally.

## Configuration sources

The provider loads Monocart options in this order of preference:

1. Inline object in `test.coverage.coverageReportOptions`
2. String path in `test.coverage.coverageReportOptions`
3. `mcr.config.js` / `.mjs` / `.cjs` / `.json` / supported `.ts` discovered from the working directory and its parents
4. Monocart defaults

Prefer a config file for shared/CI behavior. Use an inline object only for small projects or generated configs.

## Common options

```js
// mcr.config.js
export default {
    name: 'Vitest Coverage',
    outputDir: 'coverage',
    reports: ['console-details', 'v8'],
    lcov: true,
    clean: true,
    cleanCache: true
};
```

| Option | Meaning |
| --- | --- |
| `name` | Report title used by Monocart output. |
| `outputDir` | Final report directory. Use a dedicated path, never a source directory. |
| `reports` | Monocart report list. Supports strings and descriptors such as `['v8', { inline: true }]`. |
| `lcov` | Writes `lcov.info`; equivalent to adding an lcov-only report in many setups. |
| `clean` | Removes old report artifacts during Monocart generation. |
| `cleanCache` | Removes Monocart's cached input when the report is initialized. |
| `logging` | `off`, `error`, `info`, or `debug`. Debug can retain raw/cache/source-map artifacts. |
| `entryFilter` | Filters collected V8 entry URLs before conversion. |
| `sourceFilter` | Filters sources unpacked from sourcemaps and untested files. |
| `outputFilter` | Filters final `sourcePath` entries after conversion/merging (MCR 3.x). |
| `filter` | Shorthand for `entryFilter` + `sourceFilter`; not the same as `outputFilter`. |
| `sourcePath` | Rewrites a source path before report output. |
| `all` | Adds empty coverage for files that were never imported. |
| `watermarks` | Color thresholds in reports; does **not** enforce CI thresholds. |
| `onEnd` | Receives generated results; suitable for custom validation or failure logic. |

Use the installed Monocart version's declarations for the full option list. Do not invent c8/nyc/Jest options such as `checkCoverage`, `include`, or `exclude` as Monocart options.

## Reports

Typical native V8 output:

```js
export default {
    outputDir: 'coverage',
    reports: [
        'console-details',
        'v8',
        'v8-json',
        'lcovonly',
        'markdown-summary'
    ]
};
```

- `v8` produces the interactive native report and assets.
- `v8-json` produces machine-readable native V8 results.
- `lcovonly`/`lcov` produces `lcov.info` for common CI integrations.
- `console-details`/`console-summary` prints to the terminal.
- `markdown-summary`/`markdown-details` produce Markdown artifacts for CI summaries.
- `raw` is for later Monocart merging, not a substitute for rendered reports.
- Keep multiple HTML outputs in separate subdirectories with report descriptors.

The provider forces Vitest's coverage reporter to `none`. Adding `html` or `lcov` only to `test.coverage.reporter` does not configure Monocart.

## Filtering strategy

Choose one strategy for the intended scope:

### Input filtering: `entryFilter` + `sourceFilter`

Use when performance matters and the tested entry URLs are known.

```js
export default {
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

- `entryFilter` receives collected URLs/entries; excluding a bundle also excludes sources inside it.
- `sourceFilter` receives unpacked source paths and is also used for untested files.
- Ordered pattern objects use first-match-wins. Put exclusions before broader inclusions.
- `sourceFilter` alone does not remove collected entries that have no sourcemap.

### Final filtering: `outputFilter` (MCR 3.x)

Use when simpler final-path selection is more important than early exclusion.

```js
export default {
    outputFilter: {
        '**/node_modules/**': false,
        '**/src/**': true
    }
};
```

`outputFilter` runs after sourcemap conversion, merging, and `all`. It cannot restore entries removed earlier. Do not add both strategies automatically for the same scope.

### Important distinction from Vitest coverage options

Vitest `coverage.include`/`exclude` do not automatically define the Monocart report file list. They matter to Vitest's official coverage map, including `coverage.thresholds`. Configure Monocart filters separately for the report the user sees.

## Source paths and query strings

The repository's own config handles Vite resource queries:

```js
// mcr.config.js
import path from 'node:path';

export default {
    sourcePath: (filePath, info) => {
        filePath = filePath.split('?').shift();

        if (!filePath.includes('/') && info.distFile) {
            return `${path.dirname(info.distFile)}/${filePath}`;
        }

        return filePath;
    }
};
```

Use this pattern when modules such as `src/file.js?raw` appear as separate report files. Do not blindly collapse paths to basenames; unrelated `index.js` files can collide. Normalize Windows separators consistently when comparing paths across platforms.

For monorepos, set Monocart `baseDir` or a deliberate `sourcePath` rewrite when the working directory differs between collection and report generation. Verify that identical report paths refer to the same source revision.

## Untested files

Files that were never imported do not appear automatically. Add real application directories:

```js
export default {
    all: {
        dir: ['./src'],
        filter: {
            '**/*.test.js': false,
            '**/*.spec.js': false,
            '**/*.js': true
        }
    },
    sourceFilter: {
        '**/node_modules/**': false,
        '**/src/**': true
    }
};
```

This provider's raw V8 collection does not make Vitest's `coverage.include` automatically populate Monocart's `all`. Configure `all` explicitly if untested files are required.

## CI validation

Use Monocart `onEnd` for report-level validation:

```js
export default {
    outputDir: 'coverage',
    reports: ['v8', 'v8-json', 'lcovonly'],
    onEnd(results) {
        if (!results) {
            throw new Error('No coverage report was generated');
        }
        const lines = results.summary?.lines;
        if (!lines || !(lines.total > 0) || typeof lines.pct !== 'number') {
            throw new Error('Coverage summary is missing or empty');
        }
        if (lines.pct < 80) {
            throw new Error(`Line coverage ${lines.pct}% is below 80%`);
        }
    }
};
```

- `watermarks` is presentation only.
- Vitest `coverage.thresholds` is a separate gate using the official coverage map.
- If both Monocart `onEnd` and Vitest thresholds are used, make sure they examine the same intended source scope.
- Preserve the original test failure. Do not turn a failed test run into a successful coverage run.
- Do not rely on an old report file existing after a new run; validate fresh, nonempty output.
- Do not upload source-containing reports without permission.

For raw exports, shard merging, Codecov/Cobertura, snapshots, and detailed Monocart report behavior, use the Monocart coverage reports documentation as the authority.
