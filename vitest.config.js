import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/*.test.js'],
        coverage: {
            enabled: true,
            include: ['src/**'],

            provider: 'custom',
            customProviderModule: 'lib'

            // coverageReportOptions: {
            //     // logging: 'debug',
            //     name: 'My Vitest Coverage Report',
            //     reports: [
            //         ['v8'],
            //         ['console-summary']
            //     ],
            //     lcov: true,
            //     outputDir: 'coverage'
            // }

            // coverageReportOptions: 'mcr.config.js'

        }
    }
});
