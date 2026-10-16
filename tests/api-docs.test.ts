import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../server/app.js";
import { pool } from "../server/db.js";

// Authentication fixtures only: no database connection or business mutations.
for (const hideApiDocs of [false, true]) {
  for (const role of ["member", "admin", "leader"]) {
    test(`API description: hidden=${hideApiDocs}, role=${role}`, async (t) => {
      t.mock.method(pool, "query", async (sql: string) => {
        assert(sql.startsWith("SELECT u.*,s.csrf FROM sessions"));
        return {
          rowCount: 1,
          rows: [
            {
              id: "test-user",
              username: "test",
              name: "Test",
              roles: [role],
              active: true,
              csrf: "test-csrf",
            },
          ],
        };
      });
      const app = await buildApp({ hideApiDocs });
      t.after(() => app.close());
      for (const url of [
        "/api/v1/openapi.json",
        "/api/v1/openapi.json?format=json",
      ]) {
        const response = await app.inject({
          method: "GET",
          url,
          cookies: { session: "test-session" },
        });
        assert.equal(response.statusCode, hideApiDocs ? 404 : 200);
        if (hideApiDocs) {
          assert.equal(response.json().error.code, "notFound");
          assert(!response.body.includes('"paths"'));
        } else {
          assert(response.json().paths["/api/v1/tasks"]);
        }
      }
      const me = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        cookies: { session: "test-session" },
      });
      assert.equal(me.statusCode, 200);
      assert.equal(me.json().user.roles[0], role);
    });
  }
}
