# OpenTelemetry Prisma Client Instrumentation for Node.js
[![NPM version](https://img.shields.io/npm/v/opentelemetry-instrumentation-prisma-client.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-prisma-client)
[![Apache 2.0 License](https://img.shields.io/badge/license-Apache_2.0-green.svg)](https://github.com/justindsmith/opentelemetry-instrumentations-js/blob/master/LICENSE)

This module provides automatic instrumentation for [`@prisma/client`](https://github.com/prisma/prisma/tree/main/packages/client).

## NOTE

This is an unofficial plugin for the Prisma client. The Prisma team is working on official support for OpenTelemetry and progress can be tracked at https://github.com/prisma/client-planning/issues/21. Once the official support reaches the same level of capabilities of `opentelemetry-instrumentation-prisma-client`, the `opentelemetry-instrumentation-prisma-client` will be marked as deprecated.

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
tracerProvider.register();

registerInstrumentations({
  instrumentations: [
    new PrismaClientInstrumentation()
  ]
});
```

## Configuration

| Name                     | Type                                               | Default Value               | Description                                        |  |
|--------------------------|----------------------------------------------------|-----------------------------|----------------------------------------------------|--|
| spanAttributes | <code>Attributes</code> | `undefined` | An optional set of Opentelemetry Attributes to be added to the span. For example `spanAttributes: {[SemanticAttributes.DB_SYSTEM]: 'postgresql'}` |  |

## License
Apache 2.0 - See [LICENSE](https://github.com/justindsmith/opentelemetry-instrumentation-js/blob/main/LICENSE) for more information.
