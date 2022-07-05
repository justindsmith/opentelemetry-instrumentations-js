import opentelemetry, { SpanKind } from "@opentelemetry/api";
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
   * Provide string value for db.system Span attribute.
   */
  spanAttributeDbSystem?: string;
  /**
   * Provide string value for db.connection_string Span attribute.
   */
  spanAttributeDbConnectionString?: string;
  /**
   * Provide string value for db.connection_string Span attribute.
   */
  spanAttributePeerService?: string;
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
          action: string;
          args: Map<String, String>;
        };

        const {
          spanAttributeDbSystem: dbSystem,
          spanAttributeDbConnectionString: dbConnectionString,
          spanAttributePeerService: peerService
        } = plugin.getConfig()

        const span = plugin.tracer.startSpan(
          args.action,
          {
            kind: SpanKind.CLIENT,
            attributes: {
              component: "prisma",
              [SemanticAttributes.DB_STATEMENT]: args.args['query'],
              [SemanticAttributes.DB_SYSTEM]: dbSystem,
              [SemanticAttributes.DB_CONNECTION_STRING]: dbConnectionString,
              [SemanticAttributes.PEER_SERVICE]: peerService
            },
          },
          opentelemetry.context.active()
        );


        return opentelemetry.context.with(opentelemetry.trace.setSpan(opentelemetry.context.active(), span), () => {
          const promiseResponse = original.apply(this, arguments as any) as Promise<any>;

          promiseResponse
            .catch((error) => {
              span.setAttribute("error", true);
              if (error.message) {
                span.setAttribute(SemanticAttributes.EXCEPTION_MESSAGE, error.message);
              }
              if (error.stack) {
                span.setAttribute(SemanticAttributes.EXCEPTION_STACKTRACE, error.stack);
              }
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
