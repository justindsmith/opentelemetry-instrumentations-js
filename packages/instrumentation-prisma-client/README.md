# OpenTelemetry Prisma Client Instrumentation for Node.js
[![NPM version](https://img.shields.io/npm/v/opentelemetry-instrumentation-prisma-client.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-prisma-client)
[![Apache 2.0 License](https://img.shields.io/badge/license-Apache_2.0-green.svg)](https://github.com/justindsmith/opentelemetry-instrumentations-js/blob/master/LICENSE)

This module provides automatic instrumentation for [`@prisma/client`](https://github.com/prisma/prisma/tree/main/packages/client).

## Installation

```
npm install --save opentelemetry-instrumentation-prisma-client
```

## Supported Versions
- `>=3.8.0`

## Usage
For further automatic instrumentation instruction see the [@opentelemetry/instrumentation](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-instrumentation) package.

```js
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { PrismaClientInstrumentation } = require('opentelemetry-instrumentation-prisma-client');

const tracerProvider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new PrismaClientInstrumentation()
  ]
});
```

## License
Apache 2.0 - See [LICENSE](https://github.com/justindsmith/opentelemetry-instrumentation-js/blob/main/LICENSE) for more information.
