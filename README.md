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

## CMS Image Upload

The post editor includes a one-click image upload control. Every selected image is automatically center-cropped/resized to `900x520px`, converted to JPG or WEBP, and compressed below `300KB` before upload. Uploaded local images are saved under:

```text
public/assets/uploads
```

For Vercel deployment, commit and push uploaded local images if you want them to ship with the site. Runtime uploads on Vercel's serverless filesystem are not permanent; use Vercel Blob or another storage service for production-persistent CMS media.

## RSS Importer

The CMS includes an RSS importer for authorized/licensed feeds. It can read RSS items, choose a category, create a rewritten summary article, generate SEO metadata, attach the RSS source URL, and import posts as drafts or published posts.

Use this only with feeds you have permission to republish or summarize. The importer is designed around RSS summaries and source attribution; it does not scrape full article pages.

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
