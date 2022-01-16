import opentelemetry, { Span } from "@opentelemetry/api";
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from "@opentelemetry/instrumentation";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import type * as remixRunServerRuntimeData from "@remix-run/server-runtime/data";

import { VERSION } from "./version";

export class RemixInstrumentation extends InstrumentationBase {
  constructor(config: InstrumentationConfig = {}) {
    super("RemixInstrumentation", VERSION, config);
  }

  protected init() {
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

    return [remixRunServerRuntimeDataModule];
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
              span.setAttribute("error", true);
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
              span.setAttribute("error", true);
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
