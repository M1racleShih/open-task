const agreement = Object.fromEntries(
  [
    "title",
    "outcome",
    "scope",
    "criteria",
    "ownerId",
    "reviewerId",
    "plannedStart",
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
        ["post", "put", "patch", "delete"].includes(method) &&
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
      if (
        ["/api/v1/tasks", "/api/v1/events"].includes(path) &&
        method === "get"
      ) {
        operation.parameters ??= [];
        const filters: Record<string, any> = {
          time: {
            type: "string",
            enum: ["all", "week", "month", "custom"],
            default: "all",
          },
          start: { type: "string", format: "date" },
          end: { type: "string", format: "date" },
          includeUnscheduled: {
            type: "string",
            enum: ["true", "false"],
            default: "false",
          },
          includeEarlier: {
            type: "string",
            enum: ["true", "false"],
            default: "false",
          },
          projectId: { type: "string", format: "uuid" },
          search: { type: "string", maxLength: 200 },
          stage: {
            type: "string",
            enum: [
              "draft",
              "approval",
              "approvalReturned",
              "pending",
              "accepted",
              "working",
              "reviewing",
              "done",
              "cancelled",
            ],
          },
          cursor: { type: "integer", minimum: 0, default: 0 },
          limit: { type: "integer", minimum: 1, maximum: 200 },
          ...(path.endsWith("/events")
            ? {
                taskId: { type: "string", format: "uuid" },
                actorId: { type: "string", format: "uuid" },
                taskSearch: { type: "string", maxLength: 200 },
              }
            : {}),
        };
        for (const [name, schema] of Object.entries(filters))
          operation.parameters.push({
            in: "query",
            name,
            required: false,
            schema,
          });
        operation.description = path.endsWith("/tasks")
          ? "Matches permission, project, task search, status and Shanghai plan overlap before paging. Returns items, nextCursor, total, counts and separate visible ancestor context. Context never consumes a match cursor."
          : "Time filters select tasks by their latest plan, not by event time. taskSearch uses the task-list search contract; search retains the legacy event note/title search. A selected taskId bypasses viewing filters for full history.";
      }
      let properties: any;
      if (path === "/api/v1/time-preferences" && method === "put")
        properties = {
          scope: {
            type: "string",
            description:
              "global or a project UUID; always belongs to the authenticated user",
          },
          filter: {
            type: "object",
            nullable: true,
            description:
              "null restores project inheritance; not allowed for global",
            properties: {
              mode: {
                type: "string",
                enum: ["all", "week", "month", "custom"],
              },
              start: { type: "string" },
              end: { type: "string" },
              includeUnscheduled: { type: "boolean" },
              includeEarlier: { type: "boolean" },
            },
          },
        };
      else if (path === "/api/v1/tasks" && method === "post")
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
