/**
 * lib/api-errors.ts — Unified error extraction for API route catch blocks.
 *
 * Problem this solves:
 *   Several routes used `err as { status?: number; message?: string }` which
 *   silently bypasses TypeScript's type system and can misreport error codes.
 *
 * Usage:
 *   } catch (err) {
 *     const { status, message } = extractApiError(err);
 *     return NextResponse.json({ error: message }, { status });
 *   }
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ApiErrorInfo {
  /** HTTP status to return to the caller. */
  status: number;
  /** Human-readable error message. */
  message: string;
  /** Original error for server-side logging. */
  cause: unknown;
}

/**
 * Safely extract a status code and message from any thrown value.
 *
 * Priority:
 *   1. Anthropic SDK errors (have a proper `.status` code)
 *   2. Standard `Error` objects
 *   3. Unknown — return 500 with a generic message
 */
export function extractApiError(err: unknown): ApiErrorInfo {
  if (err instanceof Anthropic.APIError) {
    return {
      status: err.status ?? 500,
      message: err.message,
      cause: err,
    };
  }

  if (err instanceof Error) {
    // Map common Node/fetch error messages to appropriate HTTP codes
    const message = err.message;
    const status =
      message.includes("timeout") || message.includes("ETIMEDOUT")
        ? 504
        : message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")
        ? 502
        : 500;

    return { status, message, cause: err };
  }

  return {
    status: 500,
    message: "알 수 없는 오류가 발생했습니다",
    cause: err,
  };
}

/**
 * Return true when the error is an Anthropic rate-limit (429) or
 * overload (529) that the caller might want to retry.
 */
export function isRetryableAnthropicError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === 429 || err.status === 529;
  }
  return false;
}
