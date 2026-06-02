import { logger } from "./logger";

/**
 * Resolves the application's public base URL (scheme + host, no trailing slash).
 *
 * Resolution order, designed so the app is portable to any host (AWS, Azure,
 * etc.) and only needs configuration — never code — changes:
 *   1. PUBLIC_BASE_URL — explicit full origin, e.g. "https://app.example.com".
 *      Set this in production on any cloud provider.
 *   2. REPLIT_DEV_DOMAIN — automatically present in the Replit dev environment;
 *      used as a convenience fallback so local development works out of the box.
 *
 * Returns null when neither is configured, so callers can degrade gracefully.
 */
export function getPublicBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return `${url.protocol}//${url.host}`;
      }
      logger.warn(
        { PUBLIC_BASE_URL: explicit },
        "PUBLIC_BASE_URL must use http or https — ignoring and falling back.",
      );
    } catch {
      logger.warn(
        { PUBLIC_BASE_URL: explicit },
        "PUBLIC_BASE_URL is not a valid absolute URL (expected e.g. https://app.example.com) — ignoring and falling back.",
      );
    }
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;

  return null;
}

/** Builds an absolute URL for a path against the public base URL, or null. */
export function publicUrlFor(path: string): string | null {
  const base = getPublicBaseUrl();
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
