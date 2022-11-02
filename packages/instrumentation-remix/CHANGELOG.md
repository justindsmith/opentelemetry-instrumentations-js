# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.2.0](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.1.2...opentelemetry-instrumentation-remix@0.2.0) (2022-11-02)


* feat(remix)!: support remix 1.7.3+ breaking changes (#26) ([d7e132a](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/d7e132aff89844cd8b2906f6738784c9c21ddf3a)), closes [#26](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/26)


### BREAKING CHANGES

* `match.pathname` and `match.route.path` have been removed due to inability to read associated properties from Remix loader and action function signatures.





## [0.1.2](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.1.1...opentelemetry-instrumentation-remix@0.1.2) (2022-07-07)

**Note:** Version bump only for package opentelemetry-instrumentation-remix





## [0.1.1](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.1.0...opentelemetry-instrumentation-remix@0.1.1) (2022-07-03)


### Bug Fixes

* **remix:** update remix to 1.6.3; fix changed server-runtime data import paths ([#15](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/15)) ([4bd5cfb](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/4bd5cfb9e356d2d79413d1b72aa6fce19c0e4d10))





# [0.1.0](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.0.5...opentelemetry-instrumentation-remix@0.1.0) (2022-06-19)


### Bug Fixes

* **remix:** fix tests to support new createRequestHandler definition ([#13](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/13)) ([36b1864](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/36b186482c8ea9dace0a5aadc7cf7fabd7ef4200))


### Features

* **remix:** update form handling to default include form attributes ([#14](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/14)) ([84d1edd](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/84d1edd8754bfb6cfa4e17c7c983231352f0fc70))


### BREAKING CHANGES

* **remix:** form attributes now default to being included, use the `actionFormDataAttributes` to exclude attributes





## [0.0.5](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.0.4...opentelemetry-instrumentation-remix@0.0.5) (2022-03-19)


### Bug Fixes

* **remix:** use @remix-run/server-runtime for version testing ([#12](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/12)) ([6e514de](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/6e514dea8cb65c4f064341b2f5be6993743601b9))


### Features

* **remix:** add FormData field attributes to actions ([#10](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/10)) ([bb2f0f3](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/bb2f0f3872359bd66fb8331752dc42660bb8170c)), closes [#8](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/8)





## [0.0.4](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.0.3...opentelemetry-instrumentation-remix@0.0.4) (2022-01-28)

**Note:** Version bump only for package opentelemetry-instrumentation-remix





## [0.0.3](https://github.com/justindsmith/opentelemetry-instrumentations-js/compare/opentelemetry-instrumentation-remix@0.0.2...opentelemetry-instrumentation-remix@0.0.3) (2022-01-18)


### Features

* **remix:** add code function attribute ([#4](https://github.com/justindsmith/opentelemetry-instrumentations-js/issues/4)) ([c61ae28](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/c61ae286da837665ce2128078a449eff529bff51))





## 0.0.2 (2022-01-17)


### Features

* **remix:** add createRequestHanlder instrumentation ([dc7427f](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/dc7427f3883e2d34bcb1786bfb707922b235715d))
* **remix:** add loader and action unit tests ([a379a58](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/a379a58032df3db795f7cfbabf4c85108454b395))
* **remix:** initial instrumentation-remix ([55ee874](https://github.com/justindsmith/opentelemetry-instrumentations-js/commit/55ee8748427c74165895a73c4c1c2edf746a65d1))
