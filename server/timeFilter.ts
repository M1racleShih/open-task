import { z } from "zod";
import { relatedScopes } from "../shared/relatedFilter.js";
import {
  defaultTimeFilter,
  timeRange,
  type TimeFilter,
} from "../shared/timeFilter.js";

export const timeFilterSchema = z
  .object({
    mode: z.enum(["all", "week", "month", "custom"]).default("all"),
    start: z.string().max(10).default(""),
    end: z.string().max(10).default(""),
    includeUnscheduled: z.boolean().default(false),
    includeEarlier: z.boolean().default(false),
  })
  .superRefine((filter, ctx) => {
    try {
      timeRange(filter);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid date range" });
    }
  });
const booleanQuery = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const taskQuerySchema = z.object({
  related: z
    .string()
    .max(40)
    .transform((value) => (value === "" ? [] : value.split(",")))
    .pipe(z.array(z.enum(relatedScopes)).max(3))
    .optional(),
  search: z.string().max(200).default(""),
  projectId: z.string().uuid().optional(),
  stage: z
    .enum([
      "draft",
      "approval",
      "approvalReturned",
      "pending",
      "accepted",
      "working",
      "reviewing",
      "done",
      "cancelled",
    ])
    .optional(),
  time: z.enum(["all", "week", "month", "custom"]).default("all"),
  start: z.string().max(10).default(""),
  end: z.string().max(10).default(""),
  includeUnscheduled: booleanQuery,
  includeEarlier: booleanQuery,
});
export function queryFilter(q: z.infer<typeof taskQuerySchema>): TimeFilter {
  return timeFilterSchema.parse({ ...defaultTimeFilter, ...q, mode: q.time });
}
// Drafts created by older clients may contain unparseable optional dates.
// pg_input_is_valid prevents an old value from aborting the entire query.
const instant = (key: string) =>
  `CASE WHEN pg_input_is_valid(data->>'${key}', 'timestamp with time zone') THEN (data->>'${key}')::timestamptz END`;
export function matchedTasks(
  actorId: string,
  q: z.infer<typeof taskQuerySchema>,
) {
  const range = timeRange(queryFilter(q));
  return {
    values: [
      actorId,
      q.search,
      q.projectId ?? null,
      q.stage ?? null,
      range?.from ?? null,
      range?.until ?? null,
      q.includeUnscheduled,
      q.includeEarlier,
      q.related ?? null,
    ],
    sql: `visible AS MATERIALIZED (
      SELECT *, ${instant("deadline")} AS plan_end,
        COALESCE(${instant("plannedStart")}, ${instant("deadline")}) AS plan_start
      FROM tasks WHERE (stage<>'draft' OR creator_id=$1)
    ), matched AS MATERIALIZED (
      SELECT *, CASE WHEN $5::timestamptz IS NOT NULL AND plan_end<$5 AND plan_end IS NOT NULL THEN 'earlier' ELSE 'match' END AS source
      FROM visible WHERE ($2='' OR data->>'title' ILIKE '%'||$2||'%' OR number::text=$2)
        AND ($3::uuid IS NULL OR project_id=$3) AND ($4::text IS NULL OR stage=$4)
        AND ($9::text[] IS NULL
          OR ('owned'=ANY($9) AND data->>'ownerId'=$1::text)
          OR ('created'=ANY($9) AND (creator_id=$1::uuid OR data->>'issuerId'=$1::text))
          OR ('reviewing'=ANY($9) AND (data->>'reviewerId'=$1::text OR data->'approvalIds' ? $1::text)))
        AND ($5::timestamptz IS NULL
          OR (plan_end >= $5 AND plan_start < $6::timestamptz)
          OR ($7::boolean AND plan_end IS NULL)
          OR ($8::boolean AND plan_end<$5 AND stage NOT IN ('done','cancelled')))
    )`,
  };
}
