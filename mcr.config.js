import path from 'path';

export default {
    // logging: 'debug',

    // provider: 'istanbul',

    name: 'My Vitest Coverage Report',

    clean: true,
    cleanCache: true,

    reports: [
        'console-details',
        'v8'
    ],
    lcov: true,

    outputDir: 'coverage',

    entryFilter: {
        'browser.js?import': false,
        '*': true
    },

    sourcePath: (filePath, info) => {

        filePath = filePath.split('?').shift();

        if (!filePath.includes('/') && info.distFile) {
            return `${path.dirname(info.distFile)}/${filePath}`;
        }

        return filePath;
    },

    onEnd: (results) => {
        console.log(`coverage report generated: ${results.reportPath}`);
    }
};
