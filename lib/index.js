import path from 'path';
import { fileURLToPath } from 'url';
import EC from 'eight-colors';
import CoverageReport from 'monocart-coverage-reports';

class MonocartProvider {

    // name: string
    name = 'monocart';

    // initialize(ctx: Vitest): Promise<void> | void
    initialize(ctx) {
        // console.log(ctx);
        this.ctx = ctx;
        const config = ctx.config.coverage;
        this.customProviderOptions = config.customProviderOptions;

        this.options = {
            // User's options
            ... config,

            provider: 'v8'

        };
        // console.log('options', this.options);
        this.coverageReport = new CoverageReport(this.customProviderOptions);

    }

    // resolveOptions(): ResolvedCoverageOptions
    resolveOptions() {
        // console.log('resolveOptions', this.options);
        return this.options;
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
        // console.log('onAfterSuiteRun', coverage);
        const coverageList = coverage && coverage.result;
        // console.log(coverageList);
        if (!coverageList) {
            EC.logRed('not found coverage data');
            return;
        }

        // console.log(coverageList.map((it) => it.url));
        const transformResults = normalizeTransformResults(this.ctx.vitenode.fetchCache);
        // console.log(Array.from(transformResults.keys()));

        // add source
        coverageList.forEach((entry, i) => {
            const filePath = formatPath(fileURLToPath(entry.url));
            // console.log('============================================================');
            // console.log(entry.url);

            const result = transformResults.get(filePath);
            if (result) {
                // console.log(result);
                const { code, map } = result;

                // the code has be executed in vm.runInThisContext(), so there is a wrapper to be fixed
                // if vite-node changed the context, then it requires updating following
                //  const wrapperStart = "'use strict';async (__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exports__,__vite_ssr_exportAll__,__vite_ssr_import_meta__,require,exports,module,__filename,__dirname)=>{{";
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

        await this.coverageReport.add(coverageList);
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

