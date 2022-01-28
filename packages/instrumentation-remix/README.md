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

## License
Apache 2.0 - See [LICENSE](https://github.com/justindsmith/opentelemetry-instrumentation-js/blob/main/LICENSE) for more information.
