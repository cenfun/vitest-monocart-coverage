# Vitest Monocart Coverage

[![](https://img.shields.io/npm/v/vitest-monocart-coverage)](https://www.npmjs.com/package/vitest-monocart-coverage)
[![](https://badgen.net/npm/dw/vitest-monocart-coverage)](https://www.npmjs.com/package/vitest-monocart-coverage)
![](https://img.shields.io/github/license/cenfun/vitest-monocart-coverage)


> Generating native V8 coverage report for [Vitest](https://github.com/vitest-dev/vitest) with [Monocart coverage reports](https://github.com/cenfun/monocart-coverage-reports)

## Install
```sh
npm i vitest-monocart-coverage -D
```

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
            customProviderModule: 'vitest-monocart-coverage',

            // or a config path for coverage options
            // coverageReportOptions: "mcr.config.js"
            coverageReportOptions: {
                // https://github.com/cenfun/monocart-coverage-reports
                // logging: 'debug',

                name: 'My Vitest Coverage Report',

                reports: [
                    'console-details',
                    'v8'
                ],
                lcov: true,

                outputDir: 'coverage'
            }
        }
    }
});
```
- NOTE: `coverageReportOptions` is unknown property of Vitest `coverage` when using Typescript. Please move the `coverageReportOptions` to default config file `mcr.config.js`
- See Vitest [Custom Coverage Provider](https://vitest.dev/guide/coverage.html#custom-coverage-provider)


## Changelog

- 1.1.1
    - (Breaking) rename customProviderOptions to coverageReportOptions, and supports string as a config path
    - supports istanbul data