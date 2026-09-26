export type OperationResult<T = void> =
  | { status: "completed"; value: T }
  | { status: "cancelled"; reason: string }
  | { status: "failed"; code: string; retryable: boolean };
