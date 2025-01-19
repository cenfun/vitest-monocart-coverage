import loadProvider from './load-provider.js';

let enabled = false;

function filterResult(coverage) {
    if (!coverage.url.startsWith(window.location.origin)) {
        return false;
    }

    if (coverage.url.includes('/node_modules/')) {
        return false;
    }

    if (coverage.url.includes('__vitest_browser__')) {
        return false;
    }

    if (coverage.url.includes('__vitest__/assets')) {
        return false;
    }

    if (coverage.url.includes('__vitest_test__')) {
        return false;
    }

    // if (coverage.url === window.location.href) {
    //     return false;
    // }

    // if (coverage.url.includes('?browserv=') || coverage.url.includes('&browserv=')) {
    //     return false;
    // }

    return true;
}

const scriptSources = new Map();
const bindEvents = (target, events) => {
    Object.keys(events).forEach((eventType) => {
        target.on(eventType, events[eventType]);
    });
};


export default {
    async startCoverage() {
        if (enabled) {
            return;
        }

        enabled = true;

        const session = window.__vitest_browser_runner__.cdp;

        const jsEvents = {
            'Debugger.scriptParsed': (params) => {
                const { scriptId } = params;
                session.send('Debugger.getScriptSource', {
                    scriptId
                }).then((res) => {
                    scriptSources.set(scriptId, res && res.scriptSource);
                });
            },
            'Debugger.paused': () => {
                session.send('Debugger.resume');
            }
        };
        bindEvents(session, jsEvents);
        await session.send('Debugger.enable');
        await session.send('Debugger.setSkipAllPauses', {
            skip: true
        });


        await session.send('Profiler.enable');
        await session.send('Profiler.startPreciseCoverage', {
            callCount: true,
            detailed: true
        });
    },

    async takeCoverage() {
        const session = window.__vitest_browser_runner__.cdp;
        const coverage = await session.send('Profiler.takePreciseCoverage');
        const result = [];

        // console.log(window.__vitest_browser_runner__);

        // Reduce amount of data sent over rpc by doing some early result filtering
        // for (const entry of coverage.result) {
        //     if (filterResult(entry)) {
        //         result.push({
        //             ... entry,
        //             url: decodeURIComponent(entry.url.replace(window.location.origin, ''))
        //         });
        //     }
        // }

        if (coverage && coverage.result) {
            coverage.result.forEach((entry) => {
                // anonymous url
                entry.url = entry.url || '';

                // console.log(entry.url);

                if (!filterResult(entry)) {
                    return;
                }

                // add source
                const source = scriptSources.get(entry.scriptId);
                if (!source) {
                    console.log(`Not found js source: ${entry.url}`);
                }
                entry.source = source || '';
                result.push(entry);
            });
        }

        return {
            result
        };
    },

    stopCoverage() {
        // Browser mode should not stop coverage as same V8 instance is shared between tests
    },

    getProvider() {
        return loadProvider();
    }
};

