import path from 'path';
// import { fileURLToPath } from 'url';
import CoverageReport from 'monocart-coverage-reports';
import { createInstrumenter } from 'istanbul-lib-instrument';
import TestExclude from 'test-exclude';
import { BaseCoverageProvider } from 'vitest/coverage';

const COVERAGE_STORE_KEY = '__VITEST_COVERAGE__';
const FILE_PROTOCOL = 'file://';

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

function removeStartsWith(filepath, start) {
    if (filepath.startsWith(start)) {
        return filepath.slice(start.length);
    }
    return filepath;
}

async function onTransform(project, environment, filepath) {
    if (environment === '__browser__' && project.browser) {
        const result = await project.browser.vite.transformRequest(removeStartsWith(filepath, project.config.root));

        if (result) {
            return {
                ... result,
                code: `${result.code}// <inline-source-map>`
            };
        }
    }
    return project.vite.environments[environment].transformRequest(filepath);
}

export class MonocartProvider extends BaseCoverageProvider {

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
        // console.log('generateCoverage', _reportContext);
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

    // eslint-disable-next-line complexity
    async onAfterSuiteRun(meta) {
        const {
            coverage, environment, projectName
        } = meta;

        // console.log(meta);

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
        // console.log('start==============', coverageData.map((it) => it.url));

        const project = this.ctx.projects.find((it) => it.name === projectName) || this.ctx.projects[0];
        // console.log('project', project);

        // add source
        for (const entry of coverageData) {

            // console.log('entry', entry.url);

            // init url for browser
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

            const filePath = removeStartsWith(entry.url, FILE_PROTOCOL);

            // try {
            //     filePath = formatPath(fileURLToPath(entry.url));
            // } catch (e) {
            //     // console.log(e);
            //     return;
            // }
            // console.log('============================================================');
            // console.log(filePath);

            const result = await onTransform(project, environment, filePath);
            if (result) {
                // console.log(result);
                const { code, map } = result;

                // the code has be executed in vm.runInThisContext(), so there is a wrapper to be fixed
                // if vite-node changed the context, then it requires updating following
                // const wrapperStart = "'use strict';async (__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exports__,__vite_ssr_exportAll__,__vite_ssr_import_meta__,require,exports,module,__filename,__dirname)=>{{";
                // const wrapperEnd = '\n}}';
                // length 185 + 3 = 188
                const WRAPPER_LENGTH = entry.startOffset || 185;

                entry.scriptOffset = WRAPPER_LENGTH;
                entry.source = code;

                // fixed map url
                if (map) {
                    const relPath = relativePath(filePath);
                    map.sources = [relPath];
                }

                entry.sourceMap = map;
            } else {
                // console.log('not found file', filePath);
                // there is no sourceMap for some of files like .svg
            }

        }

        // console.log('end==============', coverageData.map((it) => it.url));

        await this.coverageReport.add(coverageData);
    }

    // reportCoverage(reportContext?: ReportContext): void | Promise<void>
    async reportCoverage(reportContext) {
        // console.log('reportCoverage', reportContext);
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
        await this.coverageReport.generate();
    }

}

