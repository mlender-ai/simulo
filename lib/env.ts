/**
 * lib/env.ts — Centralized, type-safe environment variable access.
 *
 * Rules:
 * - Always import from here instead of accessing process.env directly.
 * - `requireEnv()` throws at call-time if the variable is missing, making
 *   misconfigurations loud and obvious instead of silently passing undefined
 *   to downstream APIs.
 * - Variables that legitimately may be absent (e.g. DATABASE_URL in local dev)
 *   are exposed as `string | undefined`.
 */

function get(key: string): string | undefined {
  return process.env[key];
}

function require(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${key}. ` +
        `Check your .env.local or deployment environment.`
    );
  }
  return value;
}

export const env = {
  /** Anthropic API key — required on the server; may be overridden per-request by users. */
  ANTHROPIC_API_KEY: get("ANTHROPIC_API_KEY") as string | undefined,

  /** PostgreSQL connection string — absent in local dev without a DB. */
  DATABASE_URL: get("DATABASE_URL") as string | undefined,

  /** Node environment. */
  NODE_ENV: (get("NODE_ENV") ?? "development") as
    | "development"
    | "production"
    | "test",

  /** Model used for improvement suggestions. Defaults to claude-opus-4-6. */
  IMPROVEMENT_MODEL: get("IMPROVEMENT_MODEL") ?? "claude-opus-4-6",

  /** Design provider for code-to-figma feature. */
  DESIGN_PROVIDER: get("DESIGN_PROVIDER") ?? "rest-api",
} as const;

/**
 * Resolve the effective Anthropic API key for a request.
 * User-provided key (from the request body) takes precedence over the server key.
 * Throws if neither is available.
 */
export function resolveApiKey(userProvidedKey?: string): string {
  const key = userProvidedKey || env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "[env] No Anthropic API key available. Set ANTHROPIC_API_KEY in the environment, " +
        "or pass apiKey in the request body."
    );
  }
  return key;
}

export { require as requireEnv };
