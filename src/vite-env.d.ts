/**
 * Injected at build time by vite.config.ts `define`.
 * Value is CF_PAGES_COMMIT_SHA during Cloudflare Pages builds, or an ISO
 * timestamp during local development.  Use for debug / cache-busting.
 */
declare const __BUILD_ID__: string;
