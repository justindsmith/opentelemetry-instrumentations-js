# opentelemetry-instrumentations-js


[![Daily Tests](https://github.com/justindsmith/opentelemetry-instrumentations-js/actions/workflows/daily-test.yml/badge.svg)](http://google.com.au/)
[![Apache 2.0 License](https://img.shields.io/badge/license-Apache_2.0-green.svg)](https://github.com/justindsmith/opentelemetry-instrumentations-js/blob/master/LICENSE)

---

JavaScript extensions for the [OpenTelemetry](https://opentelemetry.io/) project.

The instrumentations in this repo are:
- vendor neutral
- strictly complies with [open telemetry semantic conventions](https://github.com/open-telemetry/opentelemetry-specification/tree/main/specification/trace/semantic_conventions)
- up to date with latest SDK version

**Compatible with [SDK stable v1.0.1](https://github.com/open-telemetry/opentelemetry-js/releases/tag/stable%2Fv1.0.1) and [SDK experimental v0.27.0](https://github.com/open-telemetry/opentelemetry-js/releases/tag/experimental%2Fv0.27.0)**
## Instrumentations
| Instrumentation Package | Instrumented Lib | NPM |
| --- | --- | --- |
| [opentelemetry-instrumentation-remix](./packages/instrumentation-remix) | [`remix`](https://remix.run/) | [![NPM version](https://img.shields.io/npm/v/opentelemetry-instrumentation-remix.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-remix) [![remix-js downloads](https://img.shields.io/npm/dm/opentelemetry-instrumentation-remix.svg)]()|



---

This repository is inspired by / forked from the Aspect.io [opentelemetry-ext-js](https://github.com/aspecto-io/opentelemetry-ext-js/) repository.