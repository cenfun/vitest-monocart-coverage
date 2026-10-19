import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import coverageV8 from '@vitest/coverage-v8';
import { CoverageReport } from 'monocart-coverage-reports';

// The V8 provider class is not part of the public exports of @vitest/coverage-v8.
// Get it from the provider instance created by the official package so we can
// reuse its coverage collection while replacing report generation.
const V8CoverageProvider = (await coverageV8.getProvider()).constructor;

const FILE_PROTOCOL = 'file://';

function decodeUrl(url) {
    try {
        return decodeURIComponent(url);
    } catch {
        return url;
    }
}

function removeStartsWith(filepath, start) {
    if (filepath.startsWith(start)) {
        return filepath.slice(start.length);
    }
    return filepath;
}

export class MonocartProvider extends V8CoverageProvider {

    name = 'monocart';

    async initialize(ctx) {

        this.version = ctx.version;

        // Reuse the official V8 provider initialization:
        // - BaseCoverageProvider._initialize()
        // - browser coverage commands
        // - autoAttachSubprocess support
        await super.initialize(ctx);

        await this.loadCoverageReport(ctx);

        // Node: use the official V8 runtime directly.
        // Browser: use lib/browser.js, which triggers the browser coverage
        // commands registered by the official V8 provider.
        const isBrowser = ctx.config.browser?.enabled;
        this.options = {
            ... this.options,
            provider: isBrowser ? 'custom' : 'v8',
            reporter: ['none']
        };
        ctx.config.coverage.provider = isBrowser ? 'custom' : 'v8';
    }

    async loadCoverageReport(ctx) {
        const coverageConfig = ctx.config.coverage;
        const coverageReportOptions = coverageConfig.coverageReportOptions;
        if (coverageReportOptions && typeof coverageReportOptions !== 'string') {
            delete coverageConfig.coverageReportOptions;
            this.coverageReport = new CoverageReport(coverageReportOptions);
            return;
        }
        this.coverageReport = new CoverageReport();
        await this.coverageReport.loadConfig(coverageReportOptions);
    }

    // Extend the official coverage file reader with raw V8 data for Monocart.
    // The original callbacks are still executed, so the official provider can
    // build its Istanbul coverage map when thresholds are enabled.
    async readCoverageFiles(options) {

        let v8CoverageData = [];

        await super.readCoverageFiles({
            onFileRead: (coverage) => {
                options.onFileRead(coverage);

                if (!coverage || !coverage.result) {
                    return;
                }

                // Clone entries because Monocart normalizes URLs and adds
                // source/sourceMap fields. The official provider uses the
                // original objects for its own conversion.
                for (const entry of coverage.result) {
                    v8CoverageData.push({
                        ... entry
                    });
                }
            },
            onFinished: async (project, environment) => {

                const entries = v8CoverageData;
                v8CoverageData = [];

                if (entries.length) {
                    await this.addSources(entries, project, environment);
                    await this.coverageReport.add(entries);
                }

                await options.onFinished(project, environment);
            },
            onDebug: options.onDebug
        });
    }

    async generateCoverage(options) {

        // Keep native V8 data for Monocart without V8 -> Istanbul conversion.
        // The official conversion is only needed for Vitest coverage thresholds.
        if (!this.options.thresholds) {
            await this.readCoverageFiles({
                onFileRead: () => {},
                onFinished: () => {},
                onDebug: {
                    enabled: false
                }
            });
            return {};
        }

        return super.generateCoverage(options);
    }

    // Normalize browser URLs to file URLs so Monocart can resolve sources
    normalizeEntryUrl(entry, project, environment) {
        if (entry.url.startsWith(FILE_PROTOCOL)) {
            return;
        }
        if (environment === 'client' && project.isBrowserEnabled()) {
            if (entry.url.startsWith('/@fs')) {
                entry.url = `${FILE_PROTOCOL}${removeStartsWith(entry.url, '/@fs')}`;
            } else if (entry.url.startsWith(project.config.root)) {
                entry.url = `${FILE_PROTOCOL}${entry.url}`;
            } else {
                entry.url = `${FILE_PROTOCOL}${project.config.root}${entry.url}`;
            }
        }
    }

    // Enrich V8 entries with the transformed source code and source maps
    async addSources(entries, project, environment) {
        for (const entry of entries) {

            entry.url = decodeUrl(entry.url);

            this.normalizeEntryUrl(entry, project, environment);

            if (entry.source) {
                continue;
            }

            let filePath;
            try {
                filePath = entry.url.startsWith(FILE_PROTOCOL) ? fileURLToPath(entry.url) : entry.url;
            } catch {
                // Skip virtual files that cannot be converted to file paths
                continue;
            }

            // Use transformFile (inherited from V8CoverageProvider) for proper source resolution
            const result = await this.transformFile(filePath, project, environment).catch(() => null);
            if (!result) {
                continue;
            }

            // V8 offsets are based on the code executed by Vitest. The module runner
            // wrapper length is stored in `startOffset` and must be applied to the source.
            entry.scriptOffset = entry.startOffset || 0;
            entry.source = result.code;

            if (result.map) {
                const relPath = path.relative(this.ctx.config.root, filePath).replace(/\\/g, '/');
                // Clone the map: the official provider may share the same cached
                // map object and rewrite `sources` for its own conversion.
                entry.sourceMap = {
                    ... result.map,
                    sources: [relPath]
                };
            }
        }
    }

    async generateReports(coverageMap, allTestsRun) {

        // Generate Monocart coverage report (handles V8 coverage data)
        await this.coverageReport.generate();

        // Support coverage thresholds through the official Istanbul coverage map
        if (this.options.thresholds) {
            await this.reportThresholds(coverageMap, allTestsRun);
        }
    }

    // Handle cleanup when Monocart's outputDir cleaning may have already
    // removed the coverage files directory (.tmp) used by vitest internally
    async cleanAfterRun() {
        this.coverageFiles = new Map();
        await fs.rm(this.coverageFilesDirectory, {
            recursive: true, force: true
        }).catch(() => {});
        await this.reportsDirectoryLock.release();
    }

}
