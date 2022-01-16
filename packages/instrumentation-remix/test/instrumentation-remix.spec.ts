import "mocha";
import * as React from "react";
import expect from "expect";
import { RemixInstrumentation } from "../src";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";
import { getTestSpans } from "opentelemetry-instrumentation-testing-utils";

const instrumentation = new RemixInstrumentation();

import { installGlobals } from "@remix-run/node";

import * as remixServerRuntime from "@remix-run/server-runtime";
import type { ServerBuild } from "@remix-run/server-runtime/build";

/** REMIX SERVER BUILD */

const routes: ServerBuild["routes"] = {
  "routes/parent": {
    id: "routes/parent",
    path: "/parent",
    module: {
      loader: async () => {
        return null;
      },
      action: async () => {
        return null;
      },
      default: () => {
        return React.createElement("div", {}, "routes/parent");
      },
    },
  },
  "routes/parent/child/$id": {
    id: "routes/parent/child/$id",
    parentId: "routes/parent",
    path: "/parent/child/:id",
    module: {
      loader: async () => {
        return null;
      },
      action: async () => {
        return null;
      },
      default: () => {
        return React.createElement("div", {}, "routes/parent/child/$id");
      },
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
};

let build: ServerBuild = {
  routes,
  assets: {
    routes,
  },
  entry: {
    module: {
      default: () => {
        return null;
      },
    },
  },
} as unknown as ServerBuild;

/** TESTS */

describe("instrumentation-remix", () => {
  let requestHandler: remixServerRuntime.RequestHandler;
  let consoleErrorImpl;
  before(() => {
    installGlobals();
    instrumentation.enable();
    requestHandler = remixServerRuntime.createRequestHandler(build, {});
    consoleErrorImpl = console.error;
    console.error = () => {};
  });

  after(() => {
    instrumentation.disable();
    console.error = consoleErrorImpl;
  });

  describe("loaders", () => {
    it("handles basic loader", (done) => {
      const request = new Request("http://localhost/parent", { method: "GET" });
      requestHandler(request, {})
        .then(() => {
          const spans = getTestSpans();
          expect(spans.length).toBe(1);

          // General properties
          expect(spans[0].name).toBe("LOADER routes/parent");

          // Request attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe("GET");
          expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/parent");

          // Match attributes
          expect(spans[0].attributes["match.pathname"]).toBe("/parent");
          expect(spans[0].attributes["match.route.id"]).toBe("routes/parent");
          expect(spans[0].attributes["match.route.path"]).toBe("/parent");

          // Response attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(200);

          // Error attributes
          expect(spans[0].attributes["error"]).toBeUndefined();
        })
        .catch((error) => {
          done(error);
        })
        .finally(done);
    });

    it("handles parent-child loaders", (done) => {
      const request = new Request("http://localhost/parent/child/123", { method: "GET" });
      requestHandler(request, {})
        .then(() => {
          const spans = getTestSpans();
          expect(spans.length).toBe(2);

          //
          // Parent span
          //

          // General properties
          expect(spans[0].name).toBe("LOADER routes/parent");

          // Request attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe("GET");
          expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/parent/child/123");

          // Match attributes
          expect(spans[0].attributes["match.pathname"]).toBe("/parent");
          expect(spans[0].attributes["match.route.id"]).toBe("routes/parent");
          expect(spans[0].attributes["match.route.path"]).toBe("/parent");
          expect(spans[0].attributes["match.params.id"]).toBe("123");

          // Response attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(200);

          // Error attributes
          expect(spans[0].attributes["error"]).toBeUndefined();

          //
          // Child span
          //

          // General properties
          expect(spans[1].name).toBe("LOADER routes/parent/child/$id");

          // Request attributes
          expect(spans[1].attributes[SemanticAttributes.HTTP_METHOD]).toBe("GET");
          expect(spans[1].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/parent/child/123");

          // Match attributes
          expect(spans[1].attributes["match.pathname"]).toBe("/parent/child/123");
          expect(spans[1].attributes["match.route.id"]).toBe("routes/parent/child/$id");
          expect(spans[1].attributes["match.route.path"]).toBe("/parent/child/:id");
          expect(spans[1].attributes["match.params.id"]).toBe("123");

          // Response attributes
          expect(spans[1].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(200);

          // Error attributes
          expect(spans[1].attributes["error"]).toBeUndefined();
        })
        .catch((error) => {
          done(error);
        })
        .finally(done);
    });

    it("handles a thrown error from loader", (done) => {
      const request = new Request("http://localhost/throws-error", { method: "GET" });
      requestHandler(request, {})
        .then(() => {
          const spans = getTestSpans();
          expect(spans.length).toBe(1);

          // General properties
          expect(spans[0].name).toBe("LOADER routes/throws-error");

          // Request attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe("GET");
          expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/throws-error");

          // Match attributes
          expect(spans[0].attributes["match.pathname"]).toBe("/throws-error");
          expect(spans[0].attributes["match.route.id"]).toBe("routes/throws-error");
          expect(spans[0].attributes["match.route.path"]).toBe("/throws-error");

          // Response attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBeUndefined();

          // Error attributes
          expect(spans[0].attributes["error"]).toBe(true);
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBe("oh no loader");
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeDefined();
        })
        .catch((error) => {
          done(error);
        })
        .finally(done);
    });
  });

  describe("actions", () => {
    it("handles basic action", (done) => {
      const request = new Request("http://localhost/parent", { method: "POST" });
      requestHandler(request, {})
        .then(() => {
          const spans = getTestSpans();
          expect(spans.length).toBe(2);

          //
          // Action span
          //

          // General properties
          expect(spans[0].name).toBe("ACTION routes/parent");

          // Request attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe("POST");
          expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/parent");

          // Match attributes
          expect(spans[0].attributes["match.pathname"]).toBe("/parent");
          expect(spans[0].attributes["match.route.id"]).toBe("routes/parent");
          expect(spans[0].attributes["match.route.path"]).toBe("/parent");

          // Response attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(200);

          // Error attributes
          expect(spans[0].attributes["error"]).toBeUndefined();
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBeUndefined();
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeUndefined();

          //
          // Loader span
          //

          // General properties
          expect(spans[1].name).toBe("LOADER routes/parent");

          // Request attributes
          expect(spans[1].attributes[SemanticAttributes.HTTP_METHOD]).toBe("POST");
          expect(spans[1].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/parent");

          // Match attributes
          expect(spans[1].attributes["match.pathname"]).toBe("/parent");
          expect(spans[1].attributes["match.route.id"]).toBe("routes/parent");
          expect(spans[1].attributes["match.route.path"]).toBe("/parent");

          // Response attributes
          expect(spans[1].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBe(200);

          // Error attributes
          expect(spans[1].attributes["error"]).toBeUndefined();
          expect(spans[1].attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBeUndefined();
          expect(spans[1].attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeUndefined();
        })
        .catch((error) => {
          done(error);
        })
        .finally(done);
    });

    it("handles a thrown error from action", (done) => {
      const request = new Request("http://localhost/throws-error", { method: "POST" });
      requestHandler(request, {})
        .then(() => {
          const spans = getTestSpans();
          expect(spans.length).toBe(1);

          // General properties
          expect(spans[0].name).toBe("ACTION routes/throws-error");

          // Request attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe("POST");
          expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe("http://localhost/throws-error");

          // Match attributes
          expect(spans[0].attributes["match.pathname"]).toBe("/throws-error");
          expect(spans[0].attributes["match.route.id"]).toBe("routes/throws-error");
          expect(spans[0].attributes["match.route.path"]).toBe("/throws-error");

          // Response attributes
          expect(spans[0].attributes[SemanticAttributes.HTTP_STATUS_CODE]).toBeUndefined();

          // Error attributes
          expect(spans[0].attributes["error"]).toBe(true);
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_MESSAGE]).toBe("oh no action");
          expect(spans[0].attributes[SemanticAttributes.EXCEPTION_STACKTRACE]).toBeDefined();
        })
        .catch((error) => {
          done(error);
        })
        .finally(done);
    });
  });
});
