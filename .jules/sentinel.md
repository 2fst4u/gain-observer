## 2025-02-20 - [Security Headers via Cloudflare Pages _headers File]
**Vulnerability:** Missing fundamental HTTP security headers (e.g., HSTS, X-Frame-Options, X-Content-Type-Options) in the production deployment.
**Learning:** For Cloudflare Pages deployments built with Vite, security headers must be defined in `public/_headers` so they are copied to `dist/_headers` and served by Cloudflare.
**Prevention:** Ensure any new security headers are appended to the `public/_headers` file.
