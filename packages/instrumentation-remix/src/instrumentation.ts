import opentelemetry, { Span } from "@opentelemetry/api";
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from "@opentelemetry/instrumentation";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import type * as remixRunServerRuntime from "@remix-run/server-runtime";
import type * as remixRunServerRuntimeData from "@remix-run/server-runtime/data";

import { VERSION } from "./version";

export class RemixInstrumentation extends InstrumentationBase {
  constructor(config: InstrumentationConfig = {}) {
    super("RemixInstrumentation", VERSION, config);
  }

  protected init() {
    const remixRunServerRuntimeModule = new InstrumentationNodeModuleDefinition<typeof remixRunServerRuntime>(
      "@remix-run/server-runtime",
      ["1.*"],
      (moduleExports: typeof remixRunServerRuntime) => {
        // callRouteLoader
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

    const remixRunServerRuntimeDataModule = new InstrumentationNodeModuleDefinition<typeof remixRunServerRuntimeData>(
      "@remix-run/server-runtime/data",
      ["1.*"],
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

    return [remixRunServerRuntimeModule, remixRunServerRuntimeDataModule];
  }

  private _patchCreateRequestHandler(): (original: typeof remixRunServerRuntime.createRequestHandler) => any {
    const plugin = this;
    return function createRequestHandler(original) {
      return function patchCreateRequestHandler(this: any): remixRunServerRuntime.RequestHandler {
        const originalRequestHandler: remixRunServerRuntime.RequestHandler = original.apply(this, arguments as any);

        return (request: Request, loadContext?: remixRunServerRuntime.AppLoadContext) => {
          const span = plugin.tracer.startSpan(`remix.requestHandler`, {}, opentelemetry.context.active());
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
              console.log("ERROR ERROR");
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
        const [params] = arguments as unknown as Parameters<typeof remixRunServerRuntimeData.callRouteLoader>;

        const span = plugin.tracer.startSpan(`LOADER ${params.match.route.id}`, {}, opentelemetry.context.active());

        addRequestAttributesToSpan(span, params.request);
        addMatchAttributesToSpan(span, params.match);

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
      return function patchCallRouteAction(this: any): Promise<Response> {
        const [params] = arguments as unknown as Parameters<typeof remixRunServerRuntimeData.callRouteAction>;

        const span = plugin.tracer.startSpan(`ACTION ${params.match.route.id}`, {}, opentelemetry.context.active());
        opentelemetry.trace.setSpan(opentelemetry.context.active(), span);

        addRequestAttributesToSpan(span, params.request);
        addMatchAttributesToSpan(span, params.match);

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
}

const addRequestAttributesToSpan = (span: Span, request: Request) => {
  span.setAttributes({
    [SemanticAttributes.HTTP_METHOD]: request.method,
    [SemanticAttributes.HTTP_URL]: request.url,
  });
};

const addMatchAttributesToSpan = (
  span: Span,
  match: Parameters<typeof remixRunServerRuntimeData.callRouteLoader>[0]["match"]
) => {
  span.setAttributes({
    ["match.pathname"]: match.pathname,
    ["match.route.id"]: match.route.id,
    ["match.route.path"]: match.route.path,
  });

  Object.keys(match.params).forEach((paramName) => {
    span.setAttribute(`match.params.${paramName}`, match.params[paramName] || "(undefined)");
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
