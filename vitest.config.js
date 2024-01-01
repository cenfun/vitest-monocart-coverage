import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/*.test.js'],
        coverage: {
            enabled: true,
            include: ['src/**'],
            provider: 'custom',
            customProviderModule: 'lib',
            customProviderOptions: {
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
