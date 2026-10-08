let csrf = "";
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestId = "",
  ) {
    super(code);
  }
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  let r: Response;
  try {
    r = await fetch("/api/v1" + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-CSRF-Token": csrf,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("networkError");
  }
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(
      data.error?.code ?? "serverError",
      data.error?.requestId,
    );
  if (data.csrf) csrf = data.csrf;
  return data;
}

export async function allPages(path: string) {
  let cursor: string | number | null = null;
  const items: any[] = [];
  do {
    const page = await api(
      path +
        (path.includes("?") ? "&" : "?") +
        (cursor ? "cursor=" + encodeURIComponent(cursor) : ""),
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return { items };
}
export async function pagesUntil(path: string, count: number) {
  const first = await api(path);
  while (first.nextCursor && first.items.length < count) {
    const page = await api(
      path + "&cursor=" + encodeURIComponent(first.nextCursor),
    );
    first.items.push(...page.items);
    first.nextCursor = page.nextCursor;
  }
  return first;
}
