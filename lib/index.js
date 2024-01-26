import path from 'path';
import { fileURLToPath } from 'url';
import EC from 'eight-colors';
import CoverageReport from 'monocart-coverage-reports';
import { createInstrumenter } from 'istanbul-lib-instrument';
import TestExclude from 'test-exclude';

const COVERAGE_STORE_KEY = '__VITEST_COVERAGE__';

class MonocartProvider {

    // name: string
    name = 'monocart';

    // initialize(ctx: Vitest): Promise<void> | void
    async initialize(ctx) {
        // console.log(ctx);
        this.ctx = ctx;
        const coverageConfig = ctx.config.coverage;

        // before import the config
        this.provider = 'v8';

        let coverageReportOptions = coverageConfig.coverageReportOptions || 'mcr.config';
        if (typeof coverageReportOptions === 'string') {
            // as a config path
            coverageReportOptions = await getOptionsFromConfigPath(coverageReportOptions);
        }

        const coverageOptions = {
            reports: coverageConfig.reporter,
            outputDir: coverageConfig.reportsDirectory,
            watermarks: coverageConfig.watermarks,
            ... coverageReportOptions
        };

        this.provider = coverageOptions.provider || 'v8';

        // console.log(coverageOptions);

        this.options = {
            // User's options
            ... coverageConfig,

            reporter: ['none'],
            provider: this.provider

        };

        // console.log(this.options);

        // console.log('options', this.options);
        this.coverageReport = new CoverageReport(coverageOptions);

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
    clean(clean = true) {
        if (clean) {
            this.coverageReport.cleanCache();
        }
    }

    // onAfterSuiteRun(meta: AfterSuiteRunMeta): void | Promise<void>
    async onAfterSuiteRun(meta) {
        const { coverage } = meta;
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

        // console.log(coverageData.map((it) => it.url));
        const transformResults = normalizeTransformResults(this.ctx.vitenode.fetchCache);
        // console.log(Array.from(transformResults.keys()));

        // add source
        coverageData.forEach((entry, i) => {
            const filePath = formatPath(fileURLToPath(entry.url));
            // console.log('============================================================');
            // console.log(entry.url);

            const result = transformResults.get(filePath);
            if (result) {
                // console.log(result);
                const { code, map } = result;

                // the code has be executed in vm.runInThisContext(), so there is a wrapper to be fixed
                // if vite-node changed the context, then it requires updating following
                // const wrapperStart = "'use strict';async (__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exports__,__vite_ssr_exportAll__,__vite_ssr_import_meta__,require,exports,module,__filename,__dirname)=>{{";
                // const wrapperEnd = '\n}}';
                // length 185 + 3 = 188

                entry.scriptOffset = 185;
                entry.source = code;

                // fixed map url
                const relPath = relativePath(filePath);
                map.sources = [relPath];

                entry.sourceMap = map;
            } else {
                EC.logRed('not found file', filePath);
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

async function getOptionsFromConfigPath(configPath) {

    let options = {};
    try {
        const data = await import(configPath);
        options = data.default || data;
    } catch (err) {
        // ignore
        // console.log(err.message);
    }

    return options;
}

export default {
    // getProvider(): CoverageProvider | Promise<CoverageProvider>
    getProvider: () => {
        return new MonocartProvider();
    }
};

