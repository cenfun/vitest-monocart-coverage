## Changelog

- 5.0.0
    - (Breaking) Removed Istanbul coverage support
    - (Breaking) Only V8 coverage is supported
    - (Breaking) Updated to Vitest v5 coverage provider API
    - (Breaking) Updated to monocart-coverage-reports v3 (ESM only, Node.js >= 22.15.0)
    - Reuse the official @vitest/coverage-v8 provider and runtime for coverage collection
    - Updated coverage collection to Vitest v5 file-based V8 coverage data
    - Updated browser coverage collection to Vitest v5 browser commands
    - Added @vitest/coverage-v8 as a dependency
    - Added `engines` requiring Node.js `>=22.15.0`
    - Added an AI agent skill under `skills/vitest-monocart-coverage/`, included in the npm package
    - Removed dependencies: @vitest/coverage-istanbul, istanbul-lib-instrument, test-exclude

- 4.0.2
    - updated deps

- 4.0.1
    - fixed #15    

- 4.0.0
    - Support Vitest V4 (#13)

- 3.0.2
    - fixed (#12)

- 3.0.1
    - exports node and browser

- 3.0.0
    - supported vitest@3
    - supported @vitest/browser@3

- 2.1.3
    - fixed errors for vitest@2.1

- 2.1.2
    - fixed the error log `not found file` (#5)

- 2.1.1
    - supported vitest workspace (#3)

- 2.1.0
    - updated for loading config

- 2.0.0
    - (Breaking) updated for vitest v2

- 1.1.1
    - (Breaking) rename customProviderOptions to coverageReportOptions, and supports string as a config path
    - supports istanbul data