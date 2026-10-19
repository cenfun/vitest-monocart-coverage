# Vitest Monocart Coverage

[![](https://img.shields.io/npm/v/vitest-monocart-coverage)](https://www.npmjs.com/package/vitest-monocart-coverage)
[![](https://badgen.net/npm/dw/vitest-monocart-coverage)](https://www.npmjs.com/package/vitest-monocart-coverage)
![](https://img.shields.io/github/license/cenfun/vitest-monocart-coverage)


> Generating native V8 coverage report for [Vitest](https://github.com/vitest-dev/vitest) with [Monocart coverage reports](https://github.com/cenfun/monocart-coverage-reports)

## Install
```sh
npm i vitest-monocart-coverage -D
```

Requires Node.js `>=22.15.0` (Vitest 5 and monocart-coverage-reports 3).

Coverage is collected with the official `@vitest/coverage-v8` provider and runtime. Monocart generates the reports directly from the raw V8 coverage data, so no V8 → Istanbul conversion is needed. Vitest coverage thresholds are still supported through the official coverage map.

## Vitest Config
```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/*.test.js'],
        coverage: {
            enabled: true,
            include: ['src/**'],
            
            provider: 'custom',
            customProviderModule: 'vitest-monocart-coverage'

        }
    }
});
```
Work with `@vitest/browser` and `@vitest/browser-playwright`
```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
    test: {

        include: ['test/*.test.js'],

        coverage: {
            enabled: true,
            include: ['src/**'],

            provider: 'custom',
            customProviderModule: 'vitest-monocart-coverage/browser'
        },

        browser: {
            enabled: true,
            headless: true,
            instances: [{
                browser: 'chromium'
            }],
            provider: playwright()
        }
    }
});
```

See Vitest [custom coverage provider](https://vitest.dev/guide/coverage.html#custom-coverage-provider)

## Config file for Coverage Options 

- mcr.config.js
- mcr.config.cjs
- mcr.config.mjs
- mcr.config.json
- mcr.config.ts

See config example [mcr.config.js](./mcr.config.js)
```js
// mcr.config.js
export default {
    // logging: 'debug',

    name: 'My Vitest Coverage Report',

    reports: [
        'console-details',
        'v8'
    ],
    lcov: true,

    outputDir: 'coverage',

    onEnd: (results) => {
        console.log(`coverage report generated: ${results.reportPath}`);
    }
};
```
See [monocart-coverage-reports](https://github.com/cenfun/monocart-coverage-reports) for more coverage options.

## AI Agent Skill

The reusable [Vitest Monocart Coverage skill](skills/vitest-monocart-coverage/SKILL.md) helps AI coding agents configure Node.js and `@vitest/browser` coverage, set Monocart options and filters, debug missing or incorrectly mapped coverage, handle thresholds, and maintain this repository. It uses a main `SKILL.md` with task-specific references loaded on demand.

The npm package includes `skills/vitest-monocart-coverage/`. Copy this **entire directory**, including `references/`, into your agent's supported skills location, or ask the agent to read `SKILL.md` directly. Installing the package does not automatically register the skill or modify agent settings. The instructions are in English; requests and responses can use any language.

From the host project root, locate the installed skill and package manifest:

```sh
node -p "require.resolve('vitest-monocart-coverage/skills/vitest-monocart-coverage/SKILL.md')"
node -p "require.resolve('vitest-monocart-coverage/package.json')"
```

Read the resolved skill, then follow its relative reference links. It supports the 5.x line and later only. These commands resolve files; they do not import Markdown as JavaScript.

## Changelog

- [CHANGELOG.md](CHANGELOG.md)
