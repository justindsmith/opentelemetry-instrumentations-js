import opentelemetry, { Attributes, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from "@opentelemetry/instrumentation";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import type * as prismaClient from "@prisma/client";

import { VERSION } from "./version";

export interface PrismaClientInstrumentationConfig extends InstrumentationConfig {
  /**
   * Attibute set to be added to each database span.
   */
  spanAttributes?: Attributes;
}

export class PrismaClientInstrumentation extends InstrumentationBase {
  constructor(config: PrismaClientInstrumentationConfig = {}) {
    super("PrismaClientInstrumentation", VERSION, config);
  }

  override getConfig(): PrismaClientInstrumentationConfig {
    return this._config;
  }

  protected init() {
    const prismaClientModule = new InstrumentationNodeModuleDefinition<typeof prismaClient>(
      "@prisma/client",
      ["*"],
      (moduleExports: typeof prismaClient) => {
        const PrismaClient = moduleExports.PrismaClient.prototype as any;

        // _request
        if (isWrapped(PrismaClient["_request"])) {
          this._unwrap(PrismaClient, "_request");
        }
        this._wrap(PrismaClient, "_request", this._patchRequest());

        return moduleExports;
      },
      (moduleExports: typeof prismaClient) => {
        const PrismaClient = moduleExports.PrismaClient.prototype as any;
        this._unwrap(PrismaClient, "_request");
      }
    );

    return [prismaClientModule];
  }

  private _patchRequest() {
    const plugin = this;
    return function (original: () => any) {
      return function patchedRequest(this: any) {
        const args = arguments[0] as {
          clientMethod: string;
          args: {
            query: string;
            parameters: {
              values: Array<string>;
              __prismaRawParameters__: boolean;
            };
          };
        };

        const span = plugin.tracer.startSpan(
          args.clientMethod,
          {
            kind: SpanKind.CLIENT,
            attributes: {
              component: "prisma",
              [SemanticAttributes.DB_STATEMENT]: args.args.query,
            },
          },
          opentelemetry.context.active()
        );

        // Add the supplied attributes from instrumentation configuration
        const { spanAttributes: spanAttributes } = plugin.getConfig();
        span.setAttributes(spanAttributes);

        return opentelemetry.context.with(opentelemetry.trace.setSpan(opentelemetry.context.active(), span), () => {
          const promiseResponse = original.apply(this, arguments as any) as Promise<any>;

          promiseResponse
            .catch((error) => {
              span.setStatus({ code: SpanStatusCode.ERROR });
              span.recordException(error);
            })
            .finally(() => {
              span.end();
            });

          return promiseResponse;
        });
      };
    };
  }
}
