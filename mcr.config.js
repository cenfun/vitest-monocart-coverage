export default {
    // logging: 'debug',
    name: 'My Vitest Coverage Report',
    reports: [
        ['v8'],
        ['console-summary']
    ],
    lcov: true,
    outputDir: 'coverage',
    onEnd: (results) => {
        console.log(`coverage report generated: ${results.reportPath}`);
    }
};
