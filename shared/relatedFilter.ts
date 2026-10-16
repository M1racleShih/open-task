import type { Task } from "./model.js";

export const relatedScopes = ["owned", "created", "reviewing"] as const;
export type RelatedScope = (typeof relatedScopes)[number];

// null means All tasks; an empty selection deliberately matches nothing.
export function relatedMatch(
  task: Pick<
    Task,
    "ownerId" | "creatorId" | "issuerId" | "reviewerId" | "approvalIds"
  >,
  userId: string,
  scopes: readonly RelatedScope[] | null,
): boolean {
  return (
    scopes === null ||
    scopes.some((scope) => {
      switch (scope) {
        case "owned":
          return task.ownerId === userId;
        case "created":
          return task.creatorId === userId || task.issuerId === userId;
        case "reviewing":
          return (
            task.reviewerId === userId || task.approvalIds.includes(userId)
          );
      }
    })
  );
}
