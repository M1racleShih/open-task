export class DomainError extends Error {
  constructor(
    public code: string,
    public statusCode = 422,
    public details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
export function ensure(
  value: unknown,
  code = "invalid",
  status = 422,
): asserts value {
  if (!value) throw new DomainError(code, status);
}
