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
