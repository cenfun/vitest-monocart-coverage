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

    onEnd: (results) => {
        console.log(`coverage report generated: ${results.reportPath}`);
    }
};
