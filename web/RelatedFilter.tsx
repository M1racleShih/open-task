import { relatedScopes, type RelatedScope } from "../shared/relatedFilter.js";
import { useI18n } from "./i18n.js";

export function RelatedFilterControls({
  active,
  scopes,
  onActiveChange,
  onScopesChange,
}: {
  active: boolean;
  scopes: RelatedScope[];
  onActiveChange: (active: boolean) => void;
  onScopesChange: (scopes: RelatedScope[]) => void;
}) {
  const { t } = useI18n();
  const summary =
    scopes.length === 3
      ? t("relatedToMe")
      : scopes.length === 1
        ? t("related_" + scopes[0])
        : scopes.length === 0
          ? t("relatedNone")
          : t("relatedSelected").replace("{count}", String(scopes.length));
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
          {t("relatedToMe")}
        </button>
      </div>
      {active && (
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
      )}
    </div>
  );
}
