import { relatedScopes, type RelatedScope } from "../shared/relatedFilter.js";

export type RelatedPreferences = {
  active: boolean;
  memberId: string;
  scopes: RelatedScope[];
};
export const defaultRelatedPreferences: RelatedPreferences = {
  active: false,
  memberId: "",
  scopes: [...relatedScopes],
};
const key = (userId: string) => "open-task.related-filter.v1." + userId;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readRelatedPreferences(
  storage: Pick<Storage, "getItem">,
  userId: string,
): RelatedPreferences {
  try {
    const value = JSON.parse(storage.getItem(key(userId)) ?? "null");
    if (!value || typeof value !== "object") return defaultRelatedPreferences;
    return {
      active: value.active === true,
      memberId:
        typeof value.memberId === "string" && uuid.test(value.memberId)
          ? value.memberId.toLowerCase()
          : "",
      scopes:
        Array.isArray(value.scopes) &&
        value.scopes.every((scope: unknown) =>
          relatedScopes.includes(scope as RelatedScope),
        )
          ? relatedScopes.filter((scope) => value.scopes.includes(scope))
          : [...relatedScopes],
    };
  } catch {
    return defaultRelatedPreferences;
  }
}
export function writeRelatedPreferences(
  storage: Pick<Storage, "setItem">,
  userId: string,
  value: RelatedPreferences,
) {
  try {
    storage.setItem(key(userId), JSON.stringify(value));
  } catch {
    // Storage may be disabled or full; filtering must remain usable.
  }
}
