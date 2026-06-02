import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'node:fs';
import { BaseCoverageProvider } from 'vitest/node';
import CoverageReport from 'monocart-coverage-reports';

const FILE_PROTOCOL = 'file://';

function removeStartsWith(filepath, start) {
    if (filepath.startsWith(start)) {
        return filepath.slice(start.length);
    }
    return filepath;
}

export class MonocartProvider extends BaseCoverageProvider {

    name = 'monocart';

    async initialize(ctx) {

        this.version = ctx.version;

        // BaseCoverageProvider._initialize() sets up:
        // - this.ctx, this.options, this.coverageFilesDirectory, this.roots
        // - reportsDirectory, thresholds, etc. from ctx._coverageOptions
        this._initialize(ctx);

        // ensure this.ctx is set
        this.ctx = ctx;

        const coverageConfig = ctx.config.coverage;
        const coverageReportOptions = coverageConfig.coverageReportOptions;
        if (coverageReportOptions && typeof coverageReportOptions !== 'string') {
            delete coverageConfig.coverageReportOptions;
            this.coverageReport = new CoverageReport(coverageReportOptions);
        } else {
            this.coverageReport = new CoverageReport();
            await this.coverageReport.loadConfig(coverageReportOptions);
        }

        // Node: use @vitest/coverage-v8 runtime for inspector-based V8 collection
        // Browser: keep custom provider for CDP-based collection via lib/browser.js
        const isBrowser = ctx.config.browser?.enabled;

        // Preserve options from _initialize() but override provider and reporter
        this.options = {
            ...this.options,
            provider: isBrowser ? 'custom' : 'v8',
            reporter: ['none']
        };

        // Ensure serialized config sent to workers has the correct provider
        coverageConfig.provider = isBrowser ? 'custom' : 'v8';

        // Accumulate raw V8 coverage entries for Monocart
        this.v8CoverageData = [];

    }

    resolveOptions() {
        return this.options;
    }

    // Collect raw V8 coverage entries from each test suite run
    // and pass them directly to Monocart (avoiding V8→Istanbul conversion)
    async onAfterSuiteRun(meta) {

        // Let BaseCoverageProvider store coverage file metadata
        // (used internally by vitest for reporting and uncovered file tracking)
        super.onAfterSuiteRun(meta);

        const { coverage, environment, projectName } = meta;
        if (!coverage) {
            return;
        }

        const coverageData = coverage.result;
        if (!coverageData) {
            return;
        }

        const project = this.ctx.projects.find((it) => it.name === projectName) || this.ctx.projects[0];
        if (!project) {
            this.v8CoverageData.push(...coverageData);
            return;
        }

        // Enrich V8 entries with source code and source maps
        for (const entry of coverageData) {

            // Normalize URL for browser mode
            if (environment === '__browser__' && project.browser) {
                if (entry.url.startsWith('/@fs')) {
                    entry.url = `${FILE_PROTOCOL}${removeStartsWith(entry.url, '/@fs')}`;
                } else if (entry.url.startsWith(project.config.root)) {
                    entry.url = `${FILE_PROTOCOL}${entry.url}`;
                } else {
                    entry.url = `${FILE_PROTOCOL}${project.config.root}${entry.url}`;
                }
            }

            if (entry.source) {
                continue;
            }

            const filePath = entry.url.startsWith(FILE_PROTOCOL) ? fileURLToPath(entry.url) : entry.url;

            // Use transformFile (inherited from BaseCoverageProvider) for proper source resolution
            // This is the same approach used by @vitest/coverage-v8's convertCoverage()
            const result = await this.transformFile(filePath, project, environment).catch(() => null);
            if (result) {
                const WRAPPER_LENGTH = entry.startOffset || 185;
                entry.scriptOffset = WRAPPER_LENGTH;
                entry.source = result.code;

                if (result.map) {
                    const relPath = path.relative(this.ctx.config.root, filePath).replace(/\\/g, '/');
                    result.map.sources = [relPath];
                }

                entry.sourceMap = result.map;
            }
        }

        this.v8CoverageData.push(...coverageData);
    }

    async generateCoverage() {
        // Pass all accumulated V8 entries to Monocart
        if (this.v8CoverageData.length) {
            await this.coverageReport.add(this.v8CoverageData);
            this.v8CoverageData = [];
        }

        // Return empty coverage map - Monocart handles all reporting
        return {};
    }

    async generateReports(coverageMap, allTestsRun) {

        // Generate Monocart coverage report (handles both v8 and Istanbul reports)
        await this.coverageReport.generate();

        // Support coverage thresholds (inherited from BaseCoverageProvider)
        if (this.options.thresholds) {
            await this.reportThresholds(coverageMap, allTestsRun);
        }
    }

    // Handle cleanup when Monocart's outputDir cleaning may have already
    // removed the coverage files directory (.tmp) used by vitest internally
    async cleanAfterRun() {
        this.coverageFiles = new Map();
        await fs.rm(this.coverageFilesDirectory, { recursive: true, force: true }).catch(() => {});
    }

}
