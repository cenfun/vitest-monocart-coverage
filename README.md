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

## Changelog

- [CHANGELOG.md](CHANGELOG.md)