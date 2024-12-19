import path from 'path';
import { fileURLToPath } from 'url';
import CoverageReport from 'monocart-coverage-reports';
import { createInstrumenter } from 'istanbul-lib-instrument';
import TestExclude from 'test-exclude';
import { BaseCoverageProvider } from 'vitest/coverage';

const COVERAGE_STORE_KEY = '__VITEST_COVERAGE__';

class MonocartProvider extends BaseCoverageProvider {

    // name: string
    name = 'monocart';

    // initialize(ctx: Vitest): Promise<void> | void
    async initialize(ctx) {

        // fixed `Running mixed versions is not supported and may lead into bugs`
        this.version = ctx.version;

        this._initialize(ctx);

        // console.log(ctx);
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

        this.provider = this.coverageReport.options.provider || 'v8';

        // console.log('provider', this.provider);
        coverageConfig.provider = this.provider;
        // fix for vitest workspace
        delete coverageConfig.customProviderModule;

        this.options = {
            // User's options
            ... coverageConfig,
            reporter: ['none']
        };

        // console.log('options', this.options);

        this.instrumenter = createInstrumenter({
            produceSourceMap: true,
            autoWrap: false,
            esModules: true,
            compact: false,
            coverageVariable: COVERAGE_STORE_KEY,
            coverageGlobalScope: 'globalThis',
            coverageGlobalScopeFunc: false,
            ignoreClassMethods: this.options.ignoreClassMethods
        });

        this.testExclude = new TestExclude({
            cwd: ctx.config.root,
            include: this.options.include,
            exclude: this.options.exclude,
            excludeNodeModules: true,
            extension: this.options.extension,
            relativePath: !this.options.allowExternal
        });

    }

    generateCoverage(_reportContext) {
        console.log('generateCoverage', _reportContext);
        return {};
    }

    // resolveOptions(): ResolvedCoverageOptions
    resolveOptions() {
        // console.log('resolveOptions', this.options);
        return this.options;
    }

    onFileTransform(sourceCode, id, pluginCtx) {

        if (this.provider !== 'istanbul') {
            return;
        }

        if (!this.testExclude.shouldInstrument(id)) {
            return;
        }

        const sourceMap = pluginCtx.getCombinedSourcemap();
        sourceMap.sources = sourceMap.sources.map((filename) => {
            return filename.split('?')[0];
        });

        const code = this.instrumenter.instrumentSync(sourceCode, id, sourceMap);
        const map = this.instrumenter.lastSourceMap();

        return {
            code, map
        };
    }

    // clean(clean?: boolean): void | Promise<void>

    // onAfterSuiteRun(meta: AfterSuiteRunMeta): void | Promise<void>
    async onAfterSuiteRun(meta) {
        const {
            coverage, transformMode, projectName
        } = meta;
        if (!coverage) {
            return;
        }

        // console.log('onAfterSuiteRun', coverage);

        if (this.provider === 'istanbul') {
            await this.coverageReport.add(coverage);
            return;
        }

        const coverageData = coverage.result;
        if (!coverageData) {
            return;
        }

        // debugger;
        // console.log(coverageData.map((it) => it.url));

        const viteNode = this.ctx.projects.find((project) => project.getName() === projectName)?.vitenode || this.ctx.vitenode;
        const fetchCache = transformMode ? viteNode.fetchCaches[transformMode] : viteNode.fetchCache;
        const transformResults = normalizeTransformResults(fetchCache);

        // const transformResults = normalizeTransformResults(this.ctx.vitenode.fetchCache);
        // console.log(Array.from(transformResults.keys()));

        // add source
        coverageData.forEach((entry, i) => {
            const filePath = formatPath(fileURLToPath(entry.url));
            // console.log('============================================================');
            // console.log(filePath);

            const result = transformResults.get(filePath);
            if (result) {
                // console.log(result);
                const { code, map } = result;

                // the code has be executed in vm.runInThisContext(), so there is a wrapper to be fixed
                // if vite-node changed the context, then it requires updating following
                // const wrapperStart = "'use strict';async (__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exports__,__vite_ssr_exportAll__,__vite_ssr_import_meta__,require,exports,module,__filename,__dirname)=>{{";
                // const wrapperEnd = '\n}}';
                // length 185 + 3 = 188
                const WRAPPER_LENGTH = 185;

                entry.scriptOffset = WRAPPER_LENGTH;
                entry.source = code;

                // fixed map url
                const relPath = relativePath(filePath);
                map.sources = [relPath];

                entry.sourceMap = map;
            } else {
                // EC.logRed('not found file', filePath);
                // there is no sourceMap for some of files like .svg
            }

        });

        await this.coverageReport.add(coverageData);
    }

    // reportCoverage(reportContext?: ReportContext): void | Promise<void>
    async reportCoverage(reportContext) {
        // console.log('reportCoverage', reportContext);
        await this.coverageReport.generate();
    }

}

// \ to /
function formatPath(str) {
    if (str) {
        str = str.replace(/\\/g, '/');
    }
    return str;
}

function relativePath(p, root) {
    p = `${p}`;
    root = `${root || process.cwd()}`;
    let rp = path.relative(root, p);
    rp = formatPath(rp);
    return rp;
}

function normalizeTransformResults(fetchCache) {
    const normalized = new Map();
    for (const [cleanEntry, value] of fetchCache.entries()) {
        if (!normalized.has(cleanEntry)) {
            normalized.set(cleanEntry, value.result);
        }
    }
    return normalized;
}

export default {
    // getProvider(): CoverageProvider | Promise<CoverageProvider>
    getProvider: () => {
        return new MonocartProvider();
    }
};

