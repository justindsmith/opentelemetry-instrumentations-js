import opentelemetry, { Span } from "@opentelemetry/api";
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from "@opentelemetry/instrumentation";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import type * as remixRunServerRuntime from "@remix-run/server-runtime";
import type * as remixRunServerRuntimeData from "@remix-run/server-runtime/dist/data";
import { Params } from "@remix-run/server-runtime/dist/router";

import { VERSION } from "./version";

const RemixSemanticAttributes = {
  MATCH_PARAMS: "match.params",
  MATCH_ROUTE_ID: "match.route.id",
};

export interface RemixInstrumentationConfig extends InstrumentationConfig {
  /**
   * Mapping of FormData field to span attribute names. Appends attribute as `formData.${name}`.
   *
   * Provide `true` value to use the FormData field name as the attribute name, or provide
   * a `string` value to map the field name to a custom attribute name.
   *
   * @default { _action: "actionType" }
   */
  actionFormDataAttributes?: Record<string, boolean | string>;
}

const DEFAULT_CONFIG: RemixInstrumentationConfig = {
  actionFormDataAttributes: {
    _action: "actionType",
  },
};

export class RemixInstrumentation extends InstrumentationBase {
  constructor(config: RemixInstrumentationConfig = {}) {
    super("RemixInstrumentation", VERSION, Object.assign({}, DEFAULT_CONFIG, config));
  }

  override getConfig(): RemixInstrumentationConfig {
    return this._config;
  }

  override setConfig(config: RemixInstrumentationConfig = {}) {
    this._config = Object.assign({}, DEFAULT_CONFIG, config);
  }

  protected init() {
    const remixRunServerRuntimeModule = new InstrumentationNodeModuleDefinition<typeof remixRunServerRuntime>(
      "@remix-run/server-runtime",
      ["1.*"],
      (moduleExports: typeof remixRunServerRuntime) => {
        // createRequestHandler
        if (isWrapped(moduleExports["createRequestHandler"])) {
          this._unwrap(moduleExports, "createRequestHandler");
        }
        this._wrap(moduleExports, "createRequestHandler", this._patchCreateRequestHandler());

        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntime) => {
        this._unwrap(moduleExports, "createRequestHandler");
      }
    );

    /*
     * Before Remix v1.6.2 we needed to wrap `@remix-run/server-runtime/data` module import instead of
     * `@remix-run/server-runtime/dist/data` module import. The wrapping logic is all the same though.
     */
    const remixRunServerRuntimeDataPre_1_6_2_Module = new InstrumentationNodeModuleDefinition<
      typeof remixRunServerRuntimeData
    >(
      "@remix-run/server-runtime/data",
      ["1.0 - 1.6.1"],
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // callRouteLoader
        if (isWrapped(moduleExports["callRouteLoader"])) {
          this._unwrap(moduleExports, "callRouteLoader");
        }
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoaderPre_1_7_2());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          this._unwrap(moduleExports, "callRouteAction");
        }
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteActionPre_1_7_2());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        this._unwrap(moduleExports, "callRouteLoader");
        this._unwrap(moduleExports, "callRouteAction");
      }
    );

    /**
     * Before Remix 1.7.3 we received the full `Match` object for each path in the route chain,
     * afterwards we only receive the `routeId` and associated `params`.
     */
    const remixRunServerRuntimeDataPre_1_7_2_Module = new InstrumentationNodeModuleDefinition<
      typeof remixRunServerRuntimeData
    >(
      "@remix-run/server-runtime/dist/data",
      ["1.6.2 - 1.7.2"],
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // callRouteLoader
        if (isWrapped(moduleExports["callRouteLoader"])) {
          this._unwrap(moduleExports, "callRouteLoader");
        }
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoaderPre_1_7_2());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          this._unwrap(moduleExports, "callRouteAction");
        }
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteActionPre_1_7_2());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        this._unwrap(moduleExports, "callRouteLoader");
        this._unwrap(moduleExports, "callRouteAction");
      }
    );

    const remixRunServerRuntimeDataModule = new InstrumentationNodeModuleDefinition<typeof remixRunServerRuntimeData>(
      "@remix-run/server-runtime/dist/data",
      ["1.7.3 - 1.*"],
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // callRouteLoader
        if (isWrapped(moduleExports["callRouteLoader"])) {
          this._unwrap(moduleExports, "callRouteLoader");
        }
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoader());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          this._unwrap(moduleExports, "callRouteAction");
        }
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteAction());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        this._unwrap(moduleExports, "callRouteLoader");
        this._unwrap(moduleExports, "callRouteAction");
      }
    );

    return [
      remixRunServerRuntimeModule,
      remixRunServerRuntimeDataPre_1_6_2_Module,
      remixRunServerRuntimeDataPre_1_7_2_Module,
      remixRunServerRuntimeDataModule,
    ];
  }

  private _patchCreateRequestHandler(): (original: typeof remixRunServerRuntime.createRequestHandler) => any {
    const plugin = this;
    return function createRequestHandler(original) {
      return function patchCreateRequestHandler(this: any): remixRunServerRuntime.RequestHandler {
        const originalRequestHandler: remixRunServerRuntime.RequestHandler = original.apply(this, arguments as any);

        return (request: Request, loadContext?: remixRunServerRuntime.AppLoadContext) => {
          const span = plugin.tracer.startSpan(
            `remix.request`,
            {
              attributes: { [SemanticAttributes.CODE_FUNCTION]: "requestHandler" },
            },
            opentelemetry.context.active()
          );
          addRequestAttributesToSpan(span, request);

          const originalResponsePromise = opentelemetry.context.with(
            opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
            () => originalRequestHandler(request, loadContext)
          );
          return originalResponsePromise
            .then((response) => {
              addResponseAttributesToSpan(span, response);
              return response;
            })
            .catch((error) => {
              addErrorAttributesToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        };
      };
    };
  }

  private _patchCallRouteLoader(): (original: typeof remixRunServerRuntimeData.callRouteLoader) => any {
    const plugin = this;
    return function callRouteLoader(original) {
      return function patchCallRouteLoader(this: any): Promise<Response> {
        const [params] = arguments as unknown as any;

        const span = plugin.tracer.startSpan(
          `LOADER ${params.routeId}`,
          { attributes: { [SemanticAttributes.CODE_FUNCTION]: "loader" } },
          opentelemetry.context.active()
        );

        addRequestAttributesToSpan(span, params.request);
        addMatchAttributesToSpan(span, { routeId: params.routeId, params: params.params });

        return opentelemetry.context.with(opentelemetry.trace.setSpan(opentelemetry.context.active(), span), () => {
          const originalResponsePromise: Promise<Response> = original.apply(this, arguments as any);
          return originalResponsePromise
            .then((response) => {
              addResponseAttributesToSpan(span, response);
              return response;
            })
            .catch((error) => {
              addErrorAttributesToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        });
      };
    };
  }

  private _patchCallRouteLoaderPre_1_7_2(): (original: typeof remixRunServerRuntimeData.callRouteLoader) => any {
    const plugin = this;
    return function callRouteLoader(original) {
      return function patchCallRouteLoader(this: any): Promise<Response> {
        // Cast as `any` to avoid typescript errors since this is patching an older version
        const [params] = arguments as unknown as any;

        const span = plugin.tracer.startSpan(
          `LOADER ${params.match.route.id}`,
          { attributes: { [SemanticAttributes.CODE_FUNCTION]: "loader" } },
          opentelemetry.context.active()
        );

        addRequestAttributesToSpan(span, params.request);
        addMatchAttributesToSpan(span, { routeId: params.match.route.id, params: params.match.params });

        return opentelemetry.context.with(opentelemetry.trace.setSpan(opentelemetry.context.active(), span), () => {
          const originalResponsePromise: Promise<Response> = original.apply(this, arguments as any);
          return originalResponsePromise
            .then((response) => {
              addResponseAttributesToSpan(span, response);
              return response;
            })
            .catch((error) => {
              addErrorAttributesToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        });
      };
    };
  }

  private _patchCallRouteAction(): (original: typeof remixRunServerRuntimeData.callRouteAction) => any {
    const plugin = this;
    return function callRouteAction(original) {
      return async function patchCallRouteAction(this: any): Promise<Response> {
        const [params] = arguments as unknown as any;
        const clonedRequest = params.request.clone();
        const span = plugin.tracer.startSpan(
          `ACTION ${params.routeId}`,
          { attributes: { [SemanticAttributes.CODE_FUNCTION]: "action" } },
          opentelemetry.context.active()
        );

        addRequestAttributesToSpan(span, clonedRequest);
        addMatchAttributesToSpan(span, { routeId: params.routeId, params: params.params });

        return opentelemetry.context.with(
          opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
          async () => {
            const originalResponsePromise: Promise<Response> = original.apply(this, arguments as any);

            return originalResponsePromise
              .then(async (response) => {
                addResponseAttributesToSpan(span, response);

                try {
                  const formData = await clonedRequest.formData();
                  const { actionFormDataAttributes: actionFormAttributes } = plugin.getConfig();
                  formData.forEach((value, key) => {
                    if (actionFormAttributes[key] !== false) {
                      const keyName = actionFormAttributes[key] === true ? key : actionFormAttributes[key];
                      span.setAttribute(`formData.${keyName}`, value.toString());
                    }
                  });
                } catch {
                  // Silently continue on any error. Typically happens because the action body cannot be processed
                  // into FormData, in which case we should just continue.
                }

                return response;
              })
              .catch(async (error) => {
                addErrorAttributesToSpan(span, error);
                throw error;
              })
              .finally(() => {
                span.end();
              });
          }
        );
      };
    };
  }

  private _patchCallRouteActionPre_1_7_2(): (original: typeof remixRunServerRuntimeData.callRouteAction) => any {
    const plugin = this;
    return function callRouteAction(original) {
      return async function patchCallRouteAction(this: any): Promise<Response> {
        // Cast as `any` to avoid typescript errors since this is patching an older version
        const [params] = arguments as unknown as any;
        const clonedRequest = params.request.clone();
        const span = plugin.tracer.startSpan(
          `ACTION ${params.match.route.id}`,
          { attributes: { [SemanticAttributes.CODE_FUNCTION]: "action" } },
          opentelemetry.context.active()
        );

        addRequestAttributesToSpan(span, clonedRequest);
        addMatchAttributesToSpan(span, { routeId: params.match.route.id, params: params.match.params });

        return opentelemetry.context.with(
          opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
          async () => {
            const originalResponsePromise: Promise<Response> = original.apply(this, arguments as any);

            return originalResponsePromise
              .then(async (response) => {
                addResponseAttributesToSpan(span, response);

                try {
                  const formData = await clonedRequest.formData();
                  const { actionFormDataAttributes: actionFormAttributes } = plugin.getConfig();
                  formData.forEach((value, key) => {
                    if (actionFormAttributes[key] !== false) {
                      const keyName = actionFormAttributes[key] === true ? key : actionFormAttributes[key];
                      span.setAttribute(`formData.${keyName}`, value.toString());
                    }
                  });
                } catch {
                  // Silently continue on any error. Typically happens because the action body cannot be processed
                  // into FormData, in which case we should just continue.
                }

                return response;
              })
              .catch(async (error) => {
                addErrorAttributesToSpan(span, error);
                throw error;
              })
              .finally(() => {
                span.end();
              });
          }
        );
      };
    };
  }
}

const addRequestAttributesToSpan = (span: Span, request: Request) => {
  span.setAttributes({
    [SemanticAttributes.HTTP_METHOD]: request.method,
    [SemanticAttributes.HTTP_URL]: request.url,
  });
};

const addMatchAttributesToSpan = (span: Span, match: { routeId: string; params: Params<string> }) => {
  span.setAttributes({
    [RemixSemanticAttributes.MATCH_ROUTE_ID]: match.routeId,
  });

  Object.keys(match.params).forEach((paramName) => {
    span.setAttribute(`${RemixSemanticAttributes.MATCH_PARAMS}.${paramName}`, match.params[paramName] || "(undefined)");
  });
};

const addResponseAttributesToSpan = (span: Span, response: Response) => {
  span.setAttributes({
    [SemanticAttributes.HTTP_STATUS_CODE]: response.status,
  });
};

const addErrorAttributesToSpan = (span: Span, error: Error) => {
  span.setAttribute("error", true);
  if (error.message) {
    span.setAttribute(SemanticAttributes.EXCEPTION_MESSAGE, error.message);
  }
  if (error.stack) {
    span.setAttribute(SemanticAttributes.EXCEPTION_STACKTRACE, error.stack);
  }
};
