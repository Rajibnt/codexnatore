# SubarnoNews CMS

Bangla news portal with server-rendered pages, article/category/search/archive routes, local CMS, RSS, robots.txt, sitemap, and social sharing.

## CMS SEO

The `/admin` editor includes per-post SEO controls:

- SEO title, meta description, focus keyword, and keyword list
- Canonical URL override
- Robots directives: index/noindex, follow/nofollow, noarchive, nosnippet, noimageindex, max snippets, image/video preview
- Open Graph and Twitter preview fields
- Schema type for structured data
- Sitemap inclusion toggle
- One-click AI SEO helper that generates metadata from the post title, excerpt, and body

## Local Run

```bash
npm start
```

Open:

- Homepage: `http://localhost:4173`
- CMS: `http://localhost:4173/admin`

## Deploy On Vercel

Import this GitHub repository into Vercel. The included `vercel.json` routes all requests to the Node handler in `server.js`.

Set `SITE_URL` in Vercel after adding your production domain, for example:

```text
SITE_URL=https://your-domain.vercel.app
```

Note: the file-based CMS writes to `data/content.json` locally. On Vercel, serverless filesystem writes are not permanent. Use local editing/commits for lasting content, or connect a database/storage service for production CMS persistence.
