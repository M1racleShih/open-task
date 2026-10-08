const agreement = Object.fromEntries(
  [
    "title",
    "outcome",
    "scope",
    "criteria",
    "ownerId",
    "reviewerId",
    "deadline",
    "acceptBy",
    "feedbackBy",
    "reviewBy",
  ].map((key) => [key, { type: "string" }]),
);
export function describeAPI(document: any) {
  document.components ??= {};
  document.components.securitySchemes = {
    session: { type: "apiKey", in: "cookie", name: "session" },
  };
  for (const [path, operations] of Object.entries(document.paths ?? {}) as [
    string,
    any,
  ][]) {
    for (const [method, operation] of Object.entries(operations) as [
      string,
      any,
    ][]) {
      operation.security =
        path === "/api/v1/sessions" && method === "post"
          ? []
          : [{ session: [] }];
      if (
        ["post", "patch", "delete"].includes(method) &&
        path !== "/api/v1/sessions"
      ) {
        operation.parameters ??= [];
        for (const name of ["X-CSRF-Token", "Idempotency-Key"])
          operation.parameters.push({
            in: "header",
            name,
            required: true,
            schema: { type: "string" },
          });
      }
      let properties: any;
      if (path === "/api/v1/tasks" && method === "post")
        properties = {
          ...agreement,
          projectId: { type: "string", nullable: true },
        };
      else if (
        (path === "/api/v1/projects" || path === "/api/v1/projects/{id}") &&
        ["post", "patch"].includes(method)
      )
        properties = {
          name: { type: "string", maxLength: 200 },
          managerId: { type: "string", format: "uuid" },
          memberIds: {
            type: "array",
            maxItems: 100,
            items: { type: "string", format: "uuid" },
          },
          color: {
            type: "string",
            pattern: "^#[0-9a-fA-F]{6}$",
            default: "#7292c7",
          },
        };
      else if (path.includes("/actions/"))
        properties = {
          version: { type: "integer" },
          fields: { type: "object", properties: agreement },
          reason: { type: "string" },
          text: { type: "string" },
          next: { type: "string" },
          feedbackBy: { type: "string" },
          reviewBy: { type: "string" },
          confirmBy: { type: "string" },
          submissionId: { type: "string" },
          requestId: { type: "string" },
          links: { type: "array", items: { type: "string", format: "uri" } },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, text: { type: "string" } },
            },
          },
          scopeChanged: { type: "boolean" },
          itemId: { type: "string" },
          checklistVersion: { type: "integer" },
          changes: {
            type: "array",
            minItems: 1,
            maxItems: 200,
            items: {
              type: "object",
              required: ["itemId", "expectedDone", "done"],
              properties: {
                itemId: { type: "string", format: "uuid" },
                expectedDone: { type: "boolean" },
                done: { type: "boolean" },
              },
            },
          },
          expectedDone: { type: "boolean" },
          done: { type: "boolean" },
          blockId: { type: "string" },
          helperId: { type: "string" },
          help: { type: "string" },
        };
      else if (path.endsWith("/relations") && method === "post")
        properties = {
          version: { type: "integer" },
          targetId: { type: "string", format: "uuid" },
          kind: { type: "string", enum: ["parent", "dependency", "related"] },
          reason: { type: "string" },
          remove: { type: "boolean" },
        };
      if (properties)
        operation.requestBody = {
          required: true,
          content: {
            "application/json": { schema: { type: "object", properties } },
          },
        };
      operation.responses ??= {};
      for (const [code, description] of Object.entries({
        "401": "Authentication required",
        "403": "Forbidden or invalid CSRF token",
        "404": "Resource missing or private",
        "409": "Version, idempotency, graph or state conflict",
        "422": "Validation failure",
        "429": "Rate limit",
        "500": "Transaction failed; no partial success",
      })) {
        operation.responses[code] = {
          description,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      requestId: { type: "string" },
                      details: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        };
      }
    }
  }
  return document;
}
