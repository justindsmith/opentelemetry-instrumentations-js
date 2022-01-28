# OpenTelemetry Remix Instrumentation for Node.js
[![NPM version](https://img.shields.io/npm/v/opentelemetry-instrumentation-remix.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-remix)
[![Apache 2.0 License](https://img.shields.io/badge/license-Apache_2.0-green.svg)](https://github.com/justindsmith/opentelemetry-instrumentations-js/blob/master/LICENSE)

This module provides automatic instrumentation for [`remix`](https://remix.run/).

## Installation

```
npm install --save opentelemetry-instrumentation-remix
```

## Supported Versions
- `^1.1.0`

**Note: ** This instrumentation does NOT support Cloudflare Workers. For more details follow [opentelemetry-js issue #1214](https://github.com/open-telemetry/opentelemetry-js/issues/1214).

## Usage
For further automatic instrumentation instruction see the [@opentelemetry/instrumentation](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-instrumentation) package.

```js
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { RemixInstrumentation } = require('opentelemetry-instrumentation-remix');

const tracerProvider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new RemixInstrumentation()
  ]
});
```

## Instrumentation

### requestHandler
Emitted for every request into remix server.

| Operation       |
|-----------------|
| `remix.request` |


| Attribute              | Description                     | Example Value                                                |
|------------------------|---------------------------------|--------------------------------------------------------------|
| `code.function`        | Name of executed function       | `"requestHandler"`                                           |
| `http.method`          | HTTP method                     | `"POST"`                                                     |
| `http.url`             | HTTP URL                        | `"https://remix.jokes/jokes/new?_data=routes%2Fjokes%2Fnew"` |
| `http.status_code`     | Response status code            | `200`                                                        |
| `error`                | Added if error detected         | `true`                                                       |
| `exception.message`    | Error message, if applicable    | `"Kaboom!"`                                                  |
| `exception.stacktrace` | Error stacktrace, if applicable | [stacktrace]                                                 |


### loader
Emitted for every `loader` called.

| Operation          | Example                       |
|--------------------|-------------------------------|
| `LOADER [routeId]` | `LOADER routes/jokes/$jokeId` |

| Attribute                  | Description                        | Example Value                                                  |
|----------------------------|------------------------------------|----------------------------------------------------------------|
| `code.function`            | Name of executed function          | `"loader"`                                                     |
| `http.method`              | HTTP method                        | `"POST"`                                                       |
| `http.url`                 | HTTP URL                           | `"https://remix.jokes/jokes/new?_data=routes%2Fjokes%2Fnew"`   |
| `http.status_code`         | Response status code               | `200`                                                          |
| `match.pathname`           | Remix matched pathname             | `"/jokes/23fc7bcf-2d35-4c70-877f-338eca1fd3ef"`                |
| `match.route.id`           | Remix matched route id             | `"routes/jokes/$jokeId"`                                       |
| `match.route.path`         | Remix matched route path           | `":jokeId"`                                                    |
| `match.params.[paramName]` | Value for each remix matched param | `[match.params.jokeId]: 23fc7bcf-2d35-4c70-877f-338eca1fd3ef"` |
| `error`                    | Added if error detected            | `true`                                                         |
| `exception.message`        | Error message, if applicable       | `"Kaboom!"`                                                    |
| `exception.stacktrace`     | Error stacktrace, if applicable    | [stacktrace]                                                   |


### action
Emitted for every `action` called.

| Operation          | Example                   |
|--------------------|---------------------------|
| `ACTION [routeId]` | `ACTION routes/jokes/new` |


| Attribute                  | Description                        | Example Value                                                   |
|----------------------------|------------------------------------|-----------------------------------------------------------------|
| `code.function`            | Name of executed function          | `"action"`                                                      |
| `http.method`              | HTTP method                        | `"POST"`                                                        |
| `http.url`                 | HTTP URL                           | `"https://remix.jokes/jokes/new?_data=routes%2Fjokes%2Fnew"`    |
| `http.status_code`         | Response status code               | `200`                                                           |
| `match.pathname`           | Remix matched pathname             | `"/jokes/23fc7bcf-2d35-4c70-877f-338eca1fd3ef"`                 |
| `match.route.id`           | Remix matched route id             | `"routes/jokes/$jokeId"`                                        |
| `match.route.path`         | Remix matched route path           | `":jokeId"`                                                     |
| `match.params.[paramName]` | Value for each remix matched param | `[match.params.jokeId]: "23fc7bcf-2d35-4c70-877f-338eca1fd3ef"` |
| `error`                    | Added if error detected            | `true`                                                          |
| `exception.message`        | Error message, if applicable       | `"Kaboom!"`                                                     |
| `exception.stacktrace`     | Error stacktrace, if applicable    | [stacktrace]                                                    |

## License
Apache 2.0 - See [LICENSE](https://github.com/justindsmith/opentelemetry-instrumentation-js/blob/main/LICENSE) for more information.
