import opentelemetry, { Span, SpanStatusCode } from "@opentelemetry/api";
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from "@opentelemetry/instrumentation";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import type * as remixRunServerRuntime from "@remix-run/server-runtime";
import type * as remixRunServerRuntimeRouteMatching from "@remix-run/server-runtime/dist/routeMatching";
import type { RouteMatch } from "@remix-run/server-runtime/dist/routeMatching";
import type { ServerRoute } from "@remix-run/server-runtime/dist/routes";
import type * as remixRunServerRuntimeData from "@remix-run/server-runtime/dist/data";

import type { Params } from "@remix-run/router";

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
  /**
   * Whether to emit errors in the form of span attributes, as well as in span exception events.
   * Defaults to `false`, meaning that only span exception events are emitted.
   */
  legacyErrorAttributes?: boolean;
}

const DEFAULT_CONFIG: RemixInstrumentationConfig = {
  actionFormDataAttributes: {
    _action: "actionType",
  },
  legacyErrorAttributes: false,
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

    const remixRunServerRuntimeRouteMatchingModule = new InstrumentationNodeModuleDefinition<
      typeof remixRunServerRuntimeRouteMatching
    >(
      "@remix-run/server-runtime/dist/routeMatching",
      ["1.6.2 - 1.x"],
      (moduleExports: typeof remixRunServerRuntimeRouteMatching) => {
        // createRequestHandler
        if (isWrapped(moduleExports["matchServerRoutes"])) {
          this._unwrap(moduleExports, "matchServerRoutes");
        }
        this._wrap(moduleExports, "matchServerRoutes", this._patchMatchServerRoutes());

        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeRouteMatching) => {
        this._unwrap(moduleExports, "matchServerRoutes");
      }
    );

    /*
     * Before Remix v1.6.2 we needed to wrap `@remix-run/server-runtime/routeMatching` module import instead of
     * `@remix-run/server-runtime/dist/routeMatching` module import. The wrapping logic is all the same though.
     */
    const remixRunServerRuntimeRouteMatchingPre_1_6_2_Module = new InstrumentationNodeModuleDefinition<
      typeof remixRunServerRuntimeRouteMatching
    >(
      "@remix-run/server-runtime/routeMatching",
      ["1.0 - 1.6.1"],
      (moduleExports: typeof remixRunServerRuntimeRouteMatching) => {
        // createRequestHandler
        if (isWrapped(moduleExports["matchServerRoutes"])) {
          this._unwrap(moduleExports, "matchServerRoutes");
        }
        this._wrap(moduleExports, "matchServerRoutes", this._patchMatchServerRoutes());

        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeRouteMatching) => {
        this._unwrap(moduleExports, "matchServerRoutes");
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
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteLoader");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoaderPre_1_7_2());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteAction");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteActionPre_1_7_2());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteLoader");
        // @ts-ignore
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
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteLoader");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoaderPre_1_7_2());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteAction");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteActionPre_1_7_2());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteLoader");
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteAction");
      }
    );

    const remixRunServerRuntimeDataPre_1_7_6_Module = new InstrumentationNodeModuleDefinition<
      typeof remixRunServerRuntimeData
    >(
      "@remix-run/server-runtime/dist/data",
      ["1.7.3 - 1.7.6"],
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // callRouteLoader
        if (isWrapped(moduleExports["callRouteLoader"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteLoader");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteLoader", this._patchCallRouteLoader());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteAction"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteAction");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteAction", this._patchCallRouteAction());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteLoader");
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteAction");
      }
    );

    /*
     * In Remix 1.8.0, the callXXLoader functions were renamed to callXXLoaderRR.
     */
    const remixRunServerRuntimeDataModule = new InstrumentationNodeModuleDefinition<typeof remixRunServerRuntimeData>(
      "@remix-run/server-runtime/dist/data",
      ["1.8.0 - 1.x"],
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // callRouteLoader
        if (isWrapped(moduleExports["callRouteLoaderRR"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteLoaderRR");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteLoaderRR", this._patchCallRouteLoader());

        // callRouteAction
        if (isWrapped(moduleExports["callRouteActionRR"])) {
          // @ts-ignore
          this._unwrap(moduleExports, "callRouteActionRR");
        }
        // @ts-ignore
        this._wrap(moduleExports, "callRouteActionRR", this._patchCallRouteAction());
        return moduleExports;
      },
      (moduleExports: typeof remixRunServerRuntimeData) => {
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteLoaderRR");
        // @ts-ignore
        this._unwrap(moduleExports, "callRouteActionRR");
      }
    );

    return [
      remixRunServerRuntimeModule,
      remixRunServerRuntimeRouteMatchingModule,
      remixRunServerRuntimeRouteMatchingPre_1_6_2_Module,
      remixRunServerRuntimeDataPre_1_6_2_Module,
      remixRunServerRuntimeDataPre_1_7_2_Module,
      remixRunServerRuntimeDataPre_1_7_6_Module,
      remixRunServerRuntimeDataModule,
    ];
  }

  private _patchMatchServerRoutes(): (original: typeof remixRunServerRuntimeRouteMatching.matchServerRoutes) => any {
    const plugin = this;
    return function matchServerRoutes(original) {
      return function patchMatchServerRoutes(this: any): RouteMatch<ServerRoute> {
        const result = original.apply(this, arguments as any);

        const span = opentelemetry.trace.getSpan(opentelemetry.context.active());

        const route = (result || []).slice(-1)[0]?.route;

        const routePath = route?.path;
        if (span && routePath) {
          span.setAttribute(SemanticAttributes.HTTP_ROUTE, routePath);
          span.updateName(`remix.request ${routePath}`);
        }

        const routeId = route?.id;
        if (span && routeId) {
          span.setAttribute(RemixSemanticAttributes.MATCH_ROUTE_ID, routeId);
        }

        return result;
      };
    };
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
              plugin.addErrorToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        };
      };
    };
  }

  // @ts-ignore
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
              plugin.addErrorToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        });
      };
    };
  }

  // @ts-ignore
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
              plugin.addErrorToSpan(span, error);
              throw error;
            })
            .finally(() => {
              span.end();
            });
        });
      };
    };
  }

  // @ts-ignore
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
                    if (actionFormAttributes[key] && actionFormAttributes[key] !== false) {
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
                plugin.addErrorToSpan(span, error);
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

  // @ts-ignore
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
                    if (actionFormAttributes[key] && actionFormAttributes[key] !== false) {
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
                plugin.addErrorToSpan(span, error);
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

  private addErrorToSpan(span: Span, error: Error) {
    addErrorEventToSpan(span, error);

    if (this.getConfig().legacyErrorAttributes || false) {
      addErrorAttributesToSpan(span, error);
    }
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

const addErrorEventToSpan = (span: Span, error: Error) => {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
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
