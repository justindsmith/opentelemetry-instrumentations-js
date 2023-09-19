import "mocha";
import * as React from "react";
import expect from "expect";
import { RemixInstrumentation } from "../src";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";
import { getTestSpans } from "opentelemetry-instrumentation-testing-utils";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";

import * as semver from "semver";

const instrumentationConfig = {
  actionFormDataAttributes: {
    _action: "actionType",
    foo: false,
    num: true,
  },
  legacyErrorAttributes: false,
};

const instrumentation = new RemixInstrumentation(instrumentationConfig);

import { installGlobals } from "@remix-run/node";

import * as remixServerRuntime from "@remix-run/server-runtime";
import type { ServerBuild, ServerEntryModule } from "@remix-run/server-runtime";
import { SpanStatusCode } from "@opentelemetry/api";
const remixServerRuntimePackage = require("@remix-run/server-runtime/package.json");

/** REMIX SERVER BUILD */

const routes: ServerBuild["routes"] = {
  "routes/parent": {
    id: "routes/parent",
    path: "/parent",
    module: {
      loader: () => "LOADER",
      action: () => "ACTION",
      default: () => React.createElement("div", {}, "routes/parent"),
    },
  },
  "routes/parent/child/$id": {
    id: "routes/parent/child/$id",
    parentId: "routes/parent",
    path: "/parent/child/:id",
    module: {
      loader: () => "LOADER",
      action: () => "ACTION",
      default: () => React.createElement("div", {}, "routes/parent/child/$id"),
    },
  },
  "routes/throws-error": {
    id: "routes/throws-error",
    path: "/throws-error",
    module: {
      loader: async () => {
        throw new Error("oh no loader");
      },
      action: async () => {
        throw new Error("oh no action");
      },
      default: undefined,
    },
  },
  "routes/has-no-loader-or-action": {
    id: "routes/has-no-loader-or-action",
    path: "/has-no-loader-or-action",
    module: {
      default: () => React.createElement("div", {}, "routes/has-no-loader-or-action"),
    },
  },
  // Implicitly used to handle 404s
  root: {
    id: "root",
    module: {
      default: () => React.createElement("div", {}, "root"),
    },
  },
};

const entryModule: ServerEntryModule = {
  default: (request, responseStatusCode, responseHeaders, context) => {
    if (new URL(request.url).search.includes("throwEntryModuleError")) {
      throw new Error("oh no entry module");
    }
    return new Response(undefined, { status: responseStatusCode, headers: responseHeaders });
  },
};

let build: ServerBuild = {
  routes,
  assets: {
    routes,
  },
  entry: {
    module: entryModule,
  },
  future: {},
} as unknown as ServerBuild;

/**
 * The `remixServerRuntime.createRequestHandler` function definition can change across versions. This
 * function will provide the proper signature based on version to creat the request handler.
 *
 * This versions used here should mirror the versions defined in `.tav.yml`.
 */
function createRequestHandlerForPackageVersion(version: string): remixServerRuntime.RequestHandler {
  if (semver.satisfies(version, "1.1.0 - 1.3.2")) {
    // Version <=1.3.2 uses a configuration object
    return (remixServerRuntime.createRequestHandler as any)(build, {}) as remixServerRuntime.RequestHandler;
  } else if (semver.satisfies(version, ">=1.3.3")) {
    // Version >=1.3.3 uses a "mode" param of type "production" | "deployment" | "test"
    return (remixServerRuntime.createRequestHandler as any)(build, "test") as remixServerRuntime.RequestHandler;
  } else {
    throw new Error("Unsupported @remix-run/server-runtime version");
  }
}

// Expects no error to appear as span attributes.
const expectNoAttributeError = (span: ReadableSpan) => {
  expect(span.attributes["error"]).toBeUndefined();
  expect(span.attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBeUndefined();
  expect(span.attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeUndefined();
};

// Expects no error to appear as a span exception event.
const expectNoEventError = (span: ReadableSpan) => {
  expect(span.status.code).not.toBe(SpanStatusCode.ERROR);
  expect(span.events.length).toBe(0);
};

// Expects no error to appear, either as span attributes or as a span exception event.
const expectNoError = (span: ReadableSpan) => {
  expectNoAttributeError(span);
  expectNoEventError(span);
};

// Expects an error to appear, both as span attributes and as a span exception event.
const expectError = (span: ReadableSpan, message: string) => {
  expectEventError(span, message);
  expectAttributeError(span, message);
};

// Expects an error to appear as span attributes.
const expectAttributeError = (span: ReadableSpan, message: string) => {
  expect(span.attributes["error"]).toBe(true);
  expect(span.attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBe(message);
  expect(span.attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeDefined();
};

// Expects an error to appear as a span exception event.
const expectEventError = (span: ReadableSpan, message: string) => {
  expect(span.status.code).toBe(SpanStatusCode.ERROR);
  expect(span.events.length).toBe(1);
  expect(span.events[0].attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBe(message);
  expect(span.events[0].attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeDefined();
};

const expectLoaderSpan = (span: ReadableSpan, route: string, params: { [key: string]: any } = {}) => {
  expect(span.name).toBe(`LOADER ${route}`);
  expect(span.attributes["match.route.id"]).toBe(route);

  Object.entries(params).forEach(([key, value]) => {
    expect(span.attributes[`match.params.${key}`]).toBe(value);
  });
};

const expectActionSpan = (span: ReadableSpan, route: string, formData: { [key: string]: any } = {}) => {
  expect(span.name).toBe(`ACTION ${route}`);
  expect(span.attributes["match.route.id"]).toBe(route);

  Object.entries(span.attributes).filter(([key]) => key.startsWith("formData.")).forEach(([key, value]) => {
    expect(formData[key.replace("formData.", "")]).toBe(value);
  });
  Object.entries(formData).forEach(([key, value]) => {
    expect(span.attributes[`formData.${key}`]).toBe(value);
  });
};

const expectRequestHandlerSpan = (span: ReadableSpan, { path, id }: { path: string; id: string }) => {
  expect(span.name).toBe(`remix.request ${path}`);
  expect(span.attributes[SemanticAttributes.HTTP_ROUTE]).toBe(path);
  expect(span.attributes["match.route.id"]).toBe(id);
};

const expectRequestHandlerMatchNotFoundSpan = (span: ReadableSpan) => {
  expect(span.name).toBe("remix.request");
  expect(span.attributes[SemanticAttributes.HTTP_ROUTE]).toBeUndefined();
  expect(span.attributes["match.route.id"]).toBeUndefined();
};

const expectParentSpan = (parent: ReadableSpan, child: ReadableSpan) => {
  expect(parent.spanContext().traceId).toBe(child.spanContext().traceId);
  expect(parent.spanContext().spanId).toBe(child.parentSpanId);
};

const expectResponseAttributes = (span: ReadableSpan, { status }: { status: number }) => {
  expect(span.attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(status);
};

const expectNoResponseAttributes = (span: ReadableSpan) => {
  expect(span.attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBeUndefined();
};

type RequestAttributes = { method: string; url: string };

const expectRequestAttributes = (span: ReadableSpan, { method, url }: RequestAttributes) => {
  expect(span.attributes[SemanticAttributes.HTTP_METHOD]).toBe(method);
  expect(span.attributes[SemanticAttributes.HTTP_URL]).toBe(url);
};

const loaderRevalidation = (attributes: RequestAttributes): RequestAttributes => {
  if (semver.satisfies(remixServerRuntimePackage.version, "<1.8.2")) {
    return attributes;
  }

  // Remix v1.8.2+ uses @remix-run/router v1.0.5, which uses a `GET` for loader revalidation instead of `POST`.
  // See: https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#105
  return {
    ...attributes,
    method: "GET",
  };
};

/** TESTS */

describe("instrumentation-remix", () => {
  let requestHandler: remixServerRuntime.RequestHandler;
  let consoleErrorImpl;
  before(() => {
    installGlobals();
    instrumentation.enable();
    requestHandler = createRequestHandlerForPackageVersion(remixServerRuntimePackage.version);
    consoleErrorImpl = console.error;
    console.error = () => {};
  });

  after(() => {
    instrumentation.disable();
    console.error = consoleErrorImpl;
  });

  describe("requestHandler", () => {
    it("has a route match when there is no loader or action", async () => {
      const request = new Request("http://localhost/has-no-loader-or-action", { method: "GET" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(1);

      const [requestHandlerSpan] = spans;

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/has-no-loader-or-action",
      };

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/has-no-loader-or-action",
        id: "routes/has-no-loader-or-action",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 200 });
      expectNoError(requestHandlerSpan);
    });

    it("does not have a route match when there is no route", async () => {
      const request = new Request("http://localhost/does-not-exist", { method: "GET" });

      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(1);

      const [requestHandlerSpan] = spans;

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/does-not-exist",
      };

      // Request handler span
      expectRequestHandlerMatchNotFoundSpan(requestHandlerSpan);
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 404 });
      expectNoError(requestHandlerSpan);
    });

    it("handles thrown error from entry module", async () => {
      const request = new Request("http://localhost/parent?throwEntryModuleError", { method: "GET" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(2);

      const [loaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, loaderSpan);

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/parent?throwEntryModuleError",
      };

      // Loader span
      expectLoaderSpan(loaderSpan, "routes/parent");
      expectRequestAttributes(loaderSpan, expectedRequestAttributes);
      expectResponseAttributes(loaderSpan, { status: 200 });
      expectNoError(loaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/parent",
        id: "routes/parent",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 500 });
      expectNoError(requestHandlerSpan);
    });
  });

  describe("loaders", () => {
    it("handles basic loader", async () => {
      const request = new Request("http://localhost/parent", { method: "GET" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(2);

      const [loaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, loaderSpan);

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/parent",
      };

      // Loader span
      expectLoaderSpan(loaderSpan, "routes/parent");
      expectRequestAttributes(loaderSpan, expectedRequestAttributes);
      expectResponseAttributes(loaderSpan, { status: 200 });
      expectNoError(loaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/parent",
        id: "routes/parent",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 200 });
      expectNoError(requestHandlerSpan);
    });

    it("handles parent-child loaders", async () => {
      const request = new Request("http://localhost/parent/child/123", { method: "GET" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(3);

      const [parentLoaderSpan, childLoaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, parentLoaderSpan);
      expectParentSpan(requestHandlerSpan, childLoaderSpan);

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/parent/child/123",
      };

      // Parent span
      expectLoaderSpan(parentLoaderSpan, "routes/parent", { id: "123" });
      expectRequestAttributes(parentLoaderSpan, expectedRequestAttributes);
      expectResponseAttributes(parentLoaderSpan, { status: 200 });
      expectNoError(parentLoaderSpan);

      // Child span
      expectLoaderSpan(childLoaderSpan, "routes/parent/child/$id", { id: "123" });
      expectRequestAttributes(childLoaderSpan, expectedRequestAttributes);
      expectResponseAttributes(childLoaderSpan, { status: 200 });
      expectNoError(childLoaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/parent/child/:id",
        id: "routes/parent/child/$id",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 200 });
      expectNoError(requestHandlerSpan);
    });

    it("handles a thrown error from loader", async () => {
      const request = new Request("http://localhost/throws-error", { method: "GET" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(2);

      const [loaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, loaderSpan);

      const expectedRequestAttributes = {
        method: "GET",
        url: "http://localhost/throws-error",
      };

      // Loader span
      expectLoaderSpan(loaderSpan, "routes/throws-error");
      expectRequestAttributes(loaderSpan, expectedRequestAttributes);
      expectNoResponseAttributes(loaderSpan);
      expectEventError(loaderSpan, "oh no loader");
      expectNoAttributeError(loaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/throws-error",
        id: "routes/throws-error",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 500 });
      expectNoError(requestHandlerSpan);
    });

    describe("with legacyErrorAttributes", () => {
      before(() => {
        instrumentation.setConfig({
          ...instrumentationConfig,
          legacyErrorAttributes: true,
        });
      });

      after(() => {
        instrumentation.setConfig(instrumentationConfig);
      });

      it("handles a thrown error from loader", async () => {
        const request = new Request("http://localhost/throws-error", { method: "GET" });
        await requestHandler(request, {});

        const spans = getTestSpans();
        expect(spans.length).toBe(2);

        const [loaderSpan, requestHandlerSpan] = spans;

        expectParentSpan(requestHandlerSpan, loaderSpan);

        const expectedRequestAttributes = {
          method: "GET",
          url: "http://localhost/throws-error",
        };

        // Loader span
        expectLoaderSpan(loaderSpan, "routes/throws-error");
        expectRequestAttributes(loaderSpan, expectedRequestAttributes);
        expectNoResponseAttributes(loaderSpan);
        expectError(loaderSpan, "oh no loader");

        // Request handler span
        expectRequestHandlerSpan(requestHandlerSpan, {
          path: "/throws-error",
          id: "routes/throws-error",
        });
        expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
        expectResponseAttributes(requestHandlerSpan, { status: 500 });
        expectNoError(requestHandlerSpan);
      });
    });
  });

  describe("actions", () => {
    it("handles basic action", async () => {
      const request = new Request("http://localhost/parent", { method: "POST" });
      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(3);

      const [actionSpan, loaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, loaderSpan);
      expectParentSpan(requestHandlerSpan, actionSpan);

      const expectedRequestAttributes = {
        method: "POST",
        url: "http://localhost/parent",
      };

      // Action span
      expectActionSpan(actionSpan, "routes/parent");
      expectRequestAttributes(actionSpan, expectedRequestAttributes);
      expectResponseAttributes(actionSpan, { status: 200 });
      expectNoError(actionSpan);

      // Loader span
      expectLoaderSpan(loaderSpan, "routes/parent");
      expectRequestAttributes(loaderSpan, loaderRevalidation(expectedRequestAttributes));
      expectResponseAttributes(loaderSpan, { status: 200 });
      expectNoError(loaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/parent",
        id: "routes/parent",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 200 });
      expectNoError(requestHandlerSpan);
    });

    it("extracts action formData fields from form data", async () => {
      const body = new FormData();
      body.append("_action", "myAction");
      body.append("foo", "bar");
      body.append("num", "123");
      body.append("password", "test123");
      const request = new Request("http://localhost/parent", {
        method: "POST",
        body,
      });

      await requestHandler(request, {});

      const spans = getTestSpans();
      expect(spans.length).toBe(3);

      const [actionSpan, loaderSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, loaderSpan);
      expectParentSpan(requestHandlerSpan, actionSpan);

      const expectedRequestAttributes = {
        method: "POST",
        url: "http://localhost/parent",
      };

      // Action span
      expectActionSpan(actionSpan, "routes/parent", {
        actionType: "myAction",
        foo: undefined,
        num: "123",
      });
      expectRequestAttributes(actionSpan, expectedRequestAttributes);
      expectResponseAttributes(actionSpan, { status: 200 });
      expectNoError(actionSpan);

      // Loader span
      expectLoaderSpan(loaderSpan, "routes/parent");
      expectRequestAttributes(loaderSpan, loaderRevalidation(expectedRequestAttributes));
      expectResponseAttributes(loaderSpan, { status: 200 });
      expectNoError(loaderSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/parent",
        id: "routes/parent",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 200 });
      expectNoError(requestHandlerSpan);
    });

    it("handles a thrown error from action", async () => {
      const request = new Request("http://localhost/throws-error", { method: "POST" });
      await requestHandler(request, {});
      const spans = getTestSpans();
      expect(spans.length).toBe(2);

      const [actionSpan, requestHandlerSpan] = spans;

      expectParentSpan(requestHandlerSpan, actionSpan);

      const expectedRequestAttributes = {
        method: "POST",
        url: "http://localhost/throws-error",
      };

      // Action span
      expectActionSpan(actionSpan, "routes/throws-error");
      expectRequestAttributes(actionSpan, expectedRequestAttributes);
      expectNoResponseAttributes(actionSpan);
      expectEventError(actionSpan, "oh no action");
      expectNoAttributeError(actionSpan);

      // Request handler span
      expectRequestHandlerSpan(requestHandlerSpan, {
        path: "/throws-error",
        id: "routes/throws-error",
      });
      expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
      expectResponseAttributes(requestHandlerSpan, { status: 500 });
      expectNoError(requestHandlerSpan);
    });

    describe("with legacyErrorAttributes", () => {
      before(() => {
        instrumentation.setConfig({
          ...instrumentationConfig,
          legacyErrorAttributes: true,
        });
      });

      after(() => {
        instrumentation.setConfig(instrumentationConfig);
      });

      it("handles a thrown error from action", async () => {
        const request = new Request("http://localhost/throws-error", { method: "POST" });
        await requestHandler(request, {});
        const spans = getTestSpans();
        expect(spans.length).toBe(2);

        const [actionSpan, requestHandlerSpan] = spans;

        expectParentSpan(requestHandlerSpan, actionSpan);

        const expectedRequestAttributes = {
          method: "POST",
          url: "http://localhost/throws-error",
        };

        // Action span
        expectActionSpan(actionSpan, "routes/throws-error");
        expectRequestAttributes(actionSpan, expectedRequestAttributes);
        expectNoResponseAttributes(actionSpan);
        expectError(actionSpan, "oh no action");

        // Request handler span
        expectRequestHandlerSpan(requestHandlerSpan, {
          path: "/throws-error",
          id: "routes/throws-error",
        });
        expectRequestAttributes(requestHandlerSpan, expectedRequestAttributes);
        expectResponseAttributes(requestHandlerSpan, { status: 500 });
        expectNoError(requestHandlerSpan);
      });
    });
  });
});
