import { relatedScopes, type RelatedScope } from "../shared/relatedFilter.js";
import type { User } from "../shared/model.js";
import { useI18n } from "./i18n.js";

export function RelatedFilterControls({
  active,
  me,
  users,
  memberId,
  onMemberChange,
  scopes,
  onActiveChange,
  onScopesChange,
}: {
  active: boolean;
  me: User;
  users: User[];
  memberId: string;
  onMemberChange: (id: string) => void;
  scopes: RelatedScope[];
  onActiveChange: (active: boolean) => void;
  onScopesChange: (scopes: RelatedScope[]) => void;
}) {
  const { t } = useI18n();
  const member = users.find((user) => user.id === memberId) ?? me;
  const memberName = memberId === me.id ? t("relatedMe") : member.name;
  const heading =
    memberId === me.id
      ? t("relatedToMe")
      : t("relatedToMember").replace("{name}", member.name);
  const summary =
    scopes.length === 3
      ? heading
      : scopes.length === 1
        ? memberName + " · " + t("related_" + scopes[0])
        : scopes.length === 0
          ? heading + " · " + t("relatedNone")
          : heading +
            " · " +
            t("relatedSelected").replace("{count}", String(scopes.length));
  return (
    <div className="related-filter">
      <div className="related-switch" role="group" aria-label={t("taskScope")}>
        <button
          type="button"
          aria-pressed={!active}
          onClick={() => onActiveChange(false)}
        >
          {t("allTasks")}
        </button>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => onActiveChange(true)}
        >
          {t("byMember")}
        </button>
      </div>
      {active && (
        <>
          <label className="related-member">
            {t("relatedMember")}
            <select
              aria-label={t("relatedMember")}
              value={memberId}
              onChange={(e) => onMemberChange(e.target.value)}
            >
              {[me, ...users.filter((user) => user.id !== me.id)].map(
                (user) => (
                  <option key={user.id} value={user.id}>
                    {user.id === me.id ? t("relatedMe") + " · " : ""}
                    {user.name} ({user.username})
                    {user.active ? "" : " · " + t("relatedInactive")}
                  </option>
                ),
              )}
            </select>
          </label>
          <details>
            <summary>{summary}</summary>
            <fieldset>
              <legend>{t("relatedScopes")}</legend>
              {relatedScopes.map((scope) => (
                <label key={scope}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(e) => {
                      onScopesChange(
                        relatedScopes.filter((item) =>
                          item === scope
                            ? e.target.checked
                            : scopes.includes(item),
                        ),
                      );
                    }}
                  />
                  {t("related_" + scope)}
                </label>
              ))}
            </fieldset>
            <small>{t("relatedHint")}</small>
          </details>
        </>
      )}
    </div>
  );
}
