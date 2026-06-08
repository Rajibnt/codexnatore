# SubarnoNews CMS

Bangla news portal with server-rendered pages, article/category/search/archive routes, local CMS, RSS, robots.txt, sitemap, and social sharing.

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
