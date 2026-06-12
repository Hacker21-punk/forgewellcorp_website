# Forgewell Corporation

Static, hardened clone of the Forgewell Corporation website — built as plain
HTML/CSS/JS with zero dependencies. No third-party branding is shipped.

## Run Locally

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## What's in the box

| File | Purpose |
| --- | --- |
| `index.html` | The page (semantic, accessible, SEO-ready). |
| `styles.css` | Hand-tuned CSS (no framework). |
| `script.js` | Vanilla JS for slider, mobile menu, scroll behaviour, SW registration. |
| `sw.js` | Service worker — cache-first static, SWR navigations. |
| `site.webmanifest` | PWA manifest. |
| `robots.txt`, `sitemap.xml` | Crawler hints. |
| `404.html` | Friendly not-found page (Obsidian & Gold themed). |
| `_headers` | Netlify-style security + caching headers (drop-in). |

## Performance

- `preload` for fonts, LCP hero image, and SVG logo (with `fetchpriority="high"`).
- `preconnect` / `dns-prefetch` to Google Fonts and ImageKit.
- `loading="lazy"` + `decoding="async"` on every off-screen image with explicit
  `width`/`height` to prevent CLS.
- `content-visibility: auto` on below-fold sections for deferred rendering.
- `will-change: opacity, transform` on slider slides for GPU compositing.
- `contain: layout style paint` on solution cards for layout containment.
- Slider is plain CSS transitions — no JS animation loop.
- Scroll handler wrapped in `requestAnimationFrame` with a `passive` listener.
- Slider pauses on hover/focus so background tabs don't burn CPU.
- Honors `prefers-reduced-motion` — slider and animations fall back to instant.
- Service worker with stale-while-revalidate for the document and
  cache-first for static assets, so repeat visits are near-instant.

## Security

- **Content-Security-Policy** meta tag + `_headers` with a tight allow-list
  (`default-src 'self'`, no `'unsafe-inline'`, JSON-LD whitelisted by
  SHA-256 hash). Both sources use the same unified hash.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (camera/mic/geo/etc. disabled),
  `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`.
- `X-DNS-Prefetch-Control: off` to prevent DNS pre-resolution leaks.
- `X-Permitted-Cross-Domain-Policies: none` to block Flash/PDF cross-domain.
- `upgrade-insecure-requests` + `block-all-mixed-content`.
- `form-action` locked to `self` (no external submissions).
- `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- Counter animation uses safe DOM methods (`textContent` + `appendChild`)
  instead of `innerHTML` — XSS defense-in-depth.
- Toast notifications use `textContent` with a `typeof string` type guard.
- No third-party scripts, no external trackers, no remote fonts beyond Google
  Fonts (whitelisted in CSP).
- All outbound links use `rel="noopener noreferrer"`.
- Newsletter form is client-side only; no third-party form handler collects
  data in the page itself.

## SEO

- Canonical URL, Open Graph, Twitter Card, JSON-LD `Organization` schema with
  full address & contact.
- `robots`, `theme-color`, `color-scheme`, viewport, description, keywords.
- SVG favicon + apple-touch-icon.

## Accessibility

- Skip-friendly landmarks (`header`, `main`, `footer`, `nav[aria-label]`).
- `aria-label` on icon-only buttons, `aria-expanded` on the menu toggle,
  `aria-hidden` on the mobile panel and inactive slides.
- `aria-current="page"` dynamically set on active nav links during scroll.
- Visible focus styles inherited from base styles.
- Form has a properly associated `<label>` (visually hidden but read by AT).
- Respects `prefers-reduced-motion`.

## Deployment

This site is ready for deployment on any static hosting provider:
- **Netlify**: Drop-in — `_headers` file is auto-detected.
- **Cloudflare Pages**: Use `_headers` or configure in `wrangler.toml`.
- **GitHub Pages**: Deploy from the `master` branch.
- **Vercel**: Add headers via `vercel.json`.

## License

Proprietary — Forgewell Corporation. All rights reserved.
