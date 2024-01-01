# vitest-monocart-coverage
> Monocart coverage reports for Vitest

## Install
```sh
npm i vitest-monocart-coverage -D
```

## Usage
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
            customProviderOptions: {
                // https://github.com/cenfun/monocart-coverage-reports?#default-options
                // logging: 'debug',
                reports: [
                    ['v8'],
                    ['v8-json']
                ],
                lcov: true,
                outputDir: 'coverage'
            }
        }
    }
});
```
