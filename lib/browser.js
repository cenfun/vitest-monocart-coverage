import loadProvider from './load-provider.js';

function filterResult(entry) {

    if (!entry.url.startsWith(window.location.origin)) {
        return false;
    }

    if (entry.url.includes('/node_modules/')) {
        return false;
    }

    if (entry.url.includes('__vitest_browser__')) {
        return false;
    }

    if (entry.url.includes('__vitest__/assets')) {
        return false;
    }

    if (entry.url === window.location.href) {
        return false;
    }

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

        const session = window.__vitest_browser_runner__.cdp;
        // const sessionId = window.__vitest_browser_runner__.sessionId;
        // console.log('================ startCoverage', sessionId);

        const jsEvents = {
            'Debugger.scriptParsed': (params) => {
                const { scriptId } = params;

                // console.log('scriptParsed', sessionId, scriptId, params.url);

                session.send('Debugger.getScriptSource', {
                    scriptId
                }).then((res) => {

                    //  console.log('getScriptSource', sessionId, scriptId, params.url);

                    scriptSources.set(scriptId, res && res.scriptSource);
                });
            },
            'Debugger.paused': () => {
                session.send('Debugger.resume');
            }
        };

        await session.send('Debugger.enable');
        await session.send('Debugger.setSkipAllPauses', {
            skip: true
        });

        bindEvents(session, jsEvents);

        await session.send('Profiler.enable');
        await session.send('Profiler.startPreciseCoverage', {
            callCount: true,
            detailed: true
        });

    },

    async takeCoverage() {

        const session = window.__vitest_browser_runner__.cdp;
        // const sessionId = window.__vitest_browser_runner__.sessionId;
        // console.log('================ takeCoverage', sessionId);

        // await new Promise((resolve) => {
        //     setTimeout(resolve, 1000);
        // });

        const coverage = await session.send('Profiler.takePreciseCoverage');
        const result = [];


        if (coverage && coverage.result) {
            coverage.result.forEach((entry) => {
                if (!filterResult(entry)) {
                    return;
                }

                entry.url = decodeURIComponent((entry.url || '').replace(window.location.origin, ''));

                //  add source
                const source = scriptSources.get(entry.scriptId);
                if (source) {
                    entry.source = source;
                }

                // console.log('=======================', entry.scriptId, entry.url);

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

