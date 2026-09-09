# Image cache during Blue-Green deployments

After the inactive release passes its production build, copy the previous
release's `.next/cache/images/` into the inactive release's
`.next/cache/images/` (preserve existing destination entries). Give the app user
ownership of the inactive cache. This cache contains only optimized public
images; do not copy page, API, session or application-data caches.

Before switching traffic, request the homepage and squad image variants through
the inactive port with `Accept: image/webp`, including mobile and desktop widths.
Check HTTP 200, image content types, and cache HIT on repeat requests. Keep the
previous release and its image cache available for rollback. Cache preparation
does not replace the normal page health checks before and after the switch.

CMS portraits use `/payload-api/media/file/` as the optimizer's internal source
because that route can read uploads created after the build. Match logos use
the public nginx `/uploads/matches/` URL for the same reason. Preserve these
runtime-upload behaviors when changing image URLs; Next's public-file list is
captured at build time.
