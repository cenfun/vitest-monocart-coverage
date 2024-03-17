export default {
    // logging: 'debug',

    // provider: 'istanbul',

    name: 'My Vitest Coverage Report',
    reports: [
        ['v8'],
        // ['html'],
        ['console-details']
    ],
    lcov: true,
    outputDir: 'coverage',
    onEnd: (results) => {
        console.log(`coverage report generated: ${results.reportPath}`);
    }
};
