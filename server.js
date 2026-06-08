const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "content.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "assets", "uploads");
const TZ = "Asia/Dhaka";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function published(data) {
  return data.articles
    .filter((article) => article.status === "published")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function htmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attr(value = "") {
  return htmlEscape(value);
}

function slugify(input) {
  const text = String(input || "").trim().toLowerCase();
  const ascii = text
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `news-${Date.now()}`;
}

function safeFilePart(input) {
  return String(input || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}

function categoryName(data, slug) {
  return data.categories.find((cat) => cat.slug === slug)?.name || slug;
}

function siteUrl(data) {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  return (process.env.SITE_URL || vercelUrl || data.settings.baseUrl || `http://localhost:${PORT}`).replace(/\/$/, "");
}

function absoluteUrl(data, url) {
  if (!url) return siteUrl(data);
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl(data)}${url.startsWith("/") ? url : `/${url}`}`;
}

function fmtDate(date, options = {}) {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options
  }).format(new Date(date));
}

function fmtTime(date) {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
}

function nowBangla() {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function truncate(text, length = 135) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function listFromInput(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function seoDefaults() {
  return {
    title: "",
    description: "",
    focusKeyword: "",
    keywords: [],
    canonical: "",
    robotsIndex: true,
    robotsFollow: true,
    noarchive: false,
    nosnippet: false,
    noimageindex: false,
    maxSnippet: "-1",
    maxImagePreview: "large",
    maxVideoPreview: "-1",
    includeInSitemap: true,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDescription: "",
    schemaType: "NewsArticle",
    seoScore: 0,
    aiGeneratedAt: ""
  };
}

function normalizedSeo(article = {}) {
  return { ...seoDefaults(), ...(article.seo || {}) };
}

function robotsContent(seoInput = {}) {
  const seo = { ...seoDefaults(), ...seoInput };
  const directives = [
    seo.robotsIndex === false ? "noindex" : "index",
    seo.robotsFollow === false ? "nofollow" : "follow"
  ];

  if (seo.noarchive) directives.push("noarchive");
  if (seo.noimageindex) directives.push("noimageindex");
  if (seo.nosnippet) {
    directives.push("nosnippet");
  } else {
    directives.push(`max-snippet:${seo.maxSnippet || "-1"}`);
  }
  directives.push(`max-image-preview:${seo.maxImagePreview || "large"}`);
  directives.push(`max-video-preview:${seo.maxVideoPreview || "-1"}`);

  return directives.join(", ");
}

function isIndexableArticle(article) {
  const seo = normalizedSeo(article);
  return article.status === "published" && seo.robotsIndex !== false && seo.includeInSitemap !== false;
}

function head(data, meta = {}) {
  const title = meta.title || `${data.settings.brandName} | ${data.settings.tagline}`;
  const description = truncate(meta.description || data.settings.description, 160);
  const canonical = meta.canonical || siteUrl(data);
  const image = absoluteUrl(data, meta.image || "/assets/news-economy.png");
  const type = meta.type || "website";
  const robots = meta.robots || "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
  const keywords = listFromInput(meta.keywords).join(", ");
  const author = meta.author || data.settings.editor;
  const ogTitle = meta.ogTitle || title;
  const ogDescription = truncate(meta.ogDescription || description, 200);
  const twitterTitle = meta.twitterTitle || ogTitle;
  const twitterDescription = truncate(meta.twitterDescription || ogDescription, 200);
  const jsonLd = meta.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
    : "";

  return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${attr(description)}">
  ${keywords ? `<meta name="keywords" content="${attr(keywords)}">` : ""}
  <meta name="author" content="${attr(author)}">
  <meta name="robots" content="${attr(robots)}">
  <link rel="canonical" href="${attr(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="${attr(data.settings.brandName)} RSS" href="${attr(siteUrl(data))}/rss.xml">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta property="og:locale" content="bn_BD">
  <meta property="og:type" content="${attr(type)}">
  <meta property="og:title" content="${attr(ogTitle)}">
  <meta property="og:description" content="${attr(ogDescription)}">
  <meta property="og:url" content="${attr(canonical)}">
  <meta property="og:image" content="${attr(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(twitterTitle)}">
  <meta name="twitter:description" content="${attr(twitterDescription)}">
  <meta name="twitter:image" content="${attr(image)}">
  <meta name="theme-color" content="#138547">
  <link rel="preload" href="/styles.css?v=20260608-share3" as="style">
  <link rel="stylesheet" href="/styles.css?v=20260608-share3">
  ${jsonLd}
</head>`;
}

function layout(data, meta, body, extra = "") {
  return `${head(data, meta)}
<body>
  <a class="skip-link" href="#content">মূল লেখায় যান</a>
  ${header(data)}
  <main id="content">
    ${body}
  </main>
  ${footer(data)}
  <script src="/site.js?v=20260608-share3" defer></script>
  ${extra}
</body>
</html>`;
}

function header(data) {
  const menuItems = data.categories.filter((cat) => cat.menu);
  const social = [
    ["facebook", "f", data.settings.facebook],
    ["youtube", "▶", data.settings.youtube],
    ["twitter", "x", data.settings.twitter],
    ["linkedin", "in", data.settings.linkedin]
  ];

  return `<header class="site-header">
    <div class="top-strip">
      <div class="container top-strip-inner">
        <div class="date-line">
          <span>ঢাকা</span>
          <span>${nowBangla()}</span>
        </div>
        <div class="social-links" aria-label="সামাজিক যোগাযোগ">
          ${social.map(([name, label, url]) => `<a class="social ${name}" href="${attr(url)}" aria-label="${attr(name)}">${label}</a>`).join("")}
          <a class="social rss" href="/rss.xml" aria-label="RSS">rss</a>
        </div>
      </div>
    </div>
    <div class="brand-row">
      <div class="container brand-wrap">
        <a class="brand" href="/" aria-label="${attr(data.settings.brandName)}">
          <span class="brand-sub">${htmlEscape(data.settings.tagline)}</span>
          <span class="brand-main"><span>সুবর্ণ</span><b>News</b><small>.com</small></span>
        </a>
        <p class="approval">${htmlEscape(data.settings.approvalText)}</p>
      </div>
    </div>
    <nav class="main-nav" aria-label="প্রধান মেনু">
      <div class="container nav-inner">
        <a class="home-link" href="/" aria-label="হোম">⌂</a>
        <button class="nav-toggle" type="button" aria-controls="navMenu" aria-expanded="false">মেনু</button>
        <div id="navMenu" class="nav-scroll">
          ${menuItems.map((cat) => `<a href="/category/${attr(cat.slug)}">${htmlEscape(cat.name)}</a>`).join("")}
          <details class="more-menu">
            <summary>বিবিধ</summary>
            <div>
              ${data.categories.filter((cat) => !cat.menu).map((cat) => `<a href="/category/${attr(cat.slug)}">${htmlEscape(cat.name)}</a>`).join("")}
              <a href="/archive">আর্কাইভ</a>
            </div>
          </details>
        </div>
        <form class="nav-search" action="/search" role="search">
          <input type="search" name="q" placeholder="অনুসন্ধান করুন" aria-label="অনুসন্ধান করুন">
          <button type="submit" aria-label="খুঁজুন">⌕</button>
        </form>
      </div>
    </nav>
  </header>`;
}

function adMarkup(ad, className = "") {
  if (!ad) return "";
  return `<a class="ad ${className}" href="${attr(ad.url)}" aria-label="${attr(ad.title)}">
    <img src="${attr(ad.image)}" alt="${attr(ad.title)}" loading="lazy">
  </a>`;
}

function storyListItem(article, data, compact = false) {
  return `<article class="story-list-item">
    <a class="thumb" href="/news/${attr(article.slug)}">
      <img src="${attr(article.image)}" alt="${attr(article.imageAlt || article.title)}" loading="lazy">
    </a>
    <div>
      <a class="story-title ${compact ? "compact" : ""}" href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a>
      <p>${htmlEscape(truncate(article.excerpt, compact ? 84 : 110))}</p>
      <span>${htmlEscape(categoryName(data, article.category))} | ${fmtTime(article.publishedAt)}</span>
    </div>
  </article>`;
}

function latestPopular(data) {
  const articles = published(data);
  const popular = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);
  const latest = articles.slice(0, 12);

  const list = (items) => `<ol>${items.map((article) => `<li><a href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a></li>`).join("")}</ol>`;

  return `<section class="side-tabs" data-tabs>
    <div class="tab-buttons" role="tablist">
      <button type="button" class="active" data-tab-button="latest">সর্বশেষ</button>
      <button type="button" data-tab-button="popular">জনপ্রিয়</button>
    </div>
    <div class="tab-panel active" data-tab-panel="latest">${list(latest)}</div>
    <div class="tab-panel" data-tab-panel="popular">${list(popular)}</div>
  </section>`;
}

function homePage(data) {
  const articles = published(data);
  const lead = articles.find((article) => article.lead) || articles[0];
  const sideLead = articles.filter((article) => article.id !== lead.id).slice(0, 5);
  const secondary = articles.filter((article) => article.id !== lead.id).slice(5, 9);
  const centerExtra = articles.filter((article) => article.id !== lead.id).slice(9, 11);
  const videos = articles.filter((article) => article.video).slice(0, 6);
  const topAd = data.ads.find((ad) => ad.position === "top");
  const sideAds = data.ads.filter((ad) => ad.position === "sidebar");

  const tickerLinks = articles.slice(0, 8).map((article) => `<a href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a>`).join("");
  const duplicateTickerLinks = tickerLinks.replaceAll("<a ", '<a tabindex="-1" ');
  const body = `<section class="container breaking-row">
      <strong>শিরোনাম</strong>
      <div class="ticker" aria-label="সর্বশেষ শিরোনাম">
        <div class="ticker-track">
          <span class="ticker-group">${tickerLinks}</span>
          <span class="ticker-group" aria-hidden="true">${duplicateTickerLinks}</span>
        </div>
      </div>
    </section>
    <section class="container ad-band">${adMarkup(topAd, "wide")}</section>
    <section class="container lead-grid">
      <div class="left-rail">
        ${sideLead.map((article) => storyListItem(article, data, true)).join("")}
      </div>
      <div class="center-stack">
        <article class="lead-card">
          <a href="/news/${attr(lead.slug)}">
            <img src="${attr(lead.image)}" alt="${attr(lead.imageAlt || lead.title)}">
            <h1>${htmlEscape(lead.title)}</h1>
          </a>
          <p>${htmlEscape(lead.excerpt)}</p>
          <div class="meta-line">${htmlEscape(lead.district)} | ${fmtDate(lead.publishedAt)} | ${fmtTime(lead.publishedAt)}</div>
        </article>
        <a class="ad center-ad" href="#" aria-label="মাঝের বিজ্ঞাপন">
          <span>Advertisement</span>
          <strong>ডিজিটাল ব্যাংকিং সল্যুশন</strong>
          <em>আপনার ব্র্যান্ড এখানে</em>
        </a>
        <div class="center-news-box">
          ${centerExtra.map((article) => storyListItem(article, data, true)).join("")}
        </div>
        <a class="ad center-ad center-ad-secondary" href="#" aria-label="দ্বিতীয় মাঝের বিজ্ঞাপন">
          <span>Advertisement</span>
          <strong>এখানে বিজ্ঞাপন দিন</strong>
          <em>হোমপেজ মিডল কলাম স্পেস</em>
        </a>
      </div>
      <aside class="right-rail" aria-label="বিজ্ঞাপন ও সর্বশেষ">
        ${adMarkup(sideAds[0], "tall")}
        ${latestPopular(data)}
      </aside>
    </section>
    <section class="container story-strip">
      ${secondary.map((article) => card(article, data)).join("")}
    </section>
    ${videoSection(videos, data)}
    <section class="container section-grid">
      ${categoryBlocks(data)}
    </section>
    <section class="container two-column-section">
      <div>
        ${sectionTitle("সারাদেশ", "/category/country")}
        <div class="feature-mini">
          ${storyListItem(articles.find((article) => article.category === "country") || articles[0], data)}
        </div>
        ${districtFinder()}
      </div>
      <aside>
        ${adMarkup(sideAds[1], "square")}
        ${archiveBox(articles)}
      </aside>
    </section>`;

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: data.settings.brandName,
    url: siteUrl(data),
    logo: absoluteUrl(data, "/assets/logo-card.png"),
    sameAs: [data.settings.facebook, data.settings.youtube, data.settings.twitter].filter((url) => url && url !== "#")
  };

  return layout(data, {
    title: `${data.settings.brandName} | ${data.settings.tagline}`,
    description: data.settings.description,
    canonical: siteUrl(data),
    image: lead.image,
    jsonLd: orgSchema
  }, body);
}

function sectionTitle(title, href) {
  return `<div class="section-title">
    <h2>${htmlEscape(title)}</h2>
    <a href="${attr(href)}">আরও</a>
  </div>`;
}

function card(article, data) {
  return `<article class="story-card">
    <a href="/news/${attr(article.slug)}">
      <img src="${attr(article.image)}" alt="${attr(article.imageAlt || article.title)}" loading="lazy">
      <span>${htmlEscape(categoryName(data, article.category))}</span>
      <h3>${htmlEscape(article.title)}</h3>
    </a>
  </article>`;
}

function videoSection(videos, data) {
  if (!videos.length) return "";
  return `<section class="container video-section">
    ${sectionTitle("ভিডিও গ্যালারি", "/category/video")}
    <div class="video-grid">
      ${videos.map((article) => `<article class="video-card">
        <a href="/news/${attr(article.slug)}">
          <img src="${attr(article.image)}" alt="${attr(article.imageAlt || article.title)}" loading="lazy">
          <span class="play">▶</span>
          <h3>${htmlEscape(article.title)}</h3>
        </a>
      </article>`).join("")}
    </div>
  </section>`;
}

function categoryBlocks(data) {
  const articles = published(data);
  const slugs = ["national", "politics", "international", "economy", "sports", "opinion", "special", "health", "education", "technology", "entertainment", "jobs"];
  return slugs.map((slug) => {
    const items = articles.filter((article) => article.category === slug).slice(0, 4);
    if (!items.length) return "";
    const [first, ...rest] = items;
    return `<section class="category-block">
      ${sectionTitle(categoryName(data, slug), `/category/${slug}`)}
      ${card(first, data)}
      <ul class="link-list">
        ${rest.map((article) => `<li><a href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a></li>`).join("")}
      </ul>
    </section>`;
  }).join("");
}

function districtFinder() {
  const divisions = ["বরিশাল", "চট্টগ্রাম", "ঢাকা", "খুলনা", "রাজশাহী", "সিলেট", "রংপুর", "ময়মনসিংহ"];
  const districts = ["ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "বরিশাল", "সিলেট", "রংপুর", "ময়মনসিংহ"];
  return `<form class="district-finder" action="/search">
    <h2>জেলার খবর</h2>
    <select name="division" aria-label="বিভাগ">
      <option value="">--বিভাগ--</option>
      ${divisions.map((name) => `<option value="${attr(name)}">${htmlEscape(name)}</option>`).join("")}
    </select>
    <select name="district" aria-label="জেলা">
      <option value="">--জেলা--</option>
      ${districts.map((name) => `<option value="${attr(name)}">${htmlEscape(name)}</option>`).join("")}
    </select>
    <button type="submit">অনুসন্ধান করুন</button>
  </form>`;
}

function archiveBox(articles) {
  const months = [...new Set(articles.map((article) => fmtDate(article.publishedAt, { month: "long", year: "numeric", day: undefined })))].slice(0, 5);
  return `<section class="archive-box">
    <h2>আর্কাইভ</h2>
    <ul>${months.map((month) => `<li><a href="/archive">${htmlEscape(month)}</a></li>`).join("")}</ul>
  </section>`;
}

function categoryPage(data, slug) {
  const cat = data.categories.find((item) => item.slug === slug);
  if (!cat) return notFound(data);
  const items = published(data).filter((article) => article.category === slug);
  const body = `<section class="container page-heading">
      <h1>${htmlEscape(cat.name)}</h1>
      <p>${htmlEscape(cat.name)} বিভাগের সর্বশেষ সংবাদ ও বিশ্লেষণ।</p>
    </section>
    <section class="container listing-layout">
      <div class="listing-grid">
        ${items.map((article) => cardLarge(article, data)).join("") || `<p class="empty">এই বিভাগে এখনো প্রকাশিত সংবাদ নেই।</p>`}
      </div>
      <aside class="right-rail">${latestPopular(data)}</aside>
    </section>`;

  return layout(data, {
    title: `${cat.name} | ${data.settings.brandName}`,
    description: `${cat.name} বিভাগের সর্বশেষ সংবাদ, বিশ্লেষণ ও আপডেট।`,
    canonical: `${siteUrl(data)}/category/${slug}`,
    image: items[0]?.image
  }, body);
}

function cardLarge(article, data) {
  return `<article class="listing-card">
    <a class="listing-image" href="/news/${attr(article.slug)}">
      <img src="${attr(article.image)}" alt="${attr(article.imageAlt || article.title)}" loading="lazy">
    </a>
    <div>
      <a class="kicker" href="/category/${attr(article.category)}">${htmlEscape(categoryName(data, article.category))}</a>
      <h2><a href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a></h2>
      <p>${htmlEscape(article.excerpt)}</p>
      <span>${htmlEscape(article.district)} | ${fmtDate(article.publishedAt)} ${fmtTime(article.publishedAt)}</span>
    </div>
  </article>`;
}

function shareIcon(name) {
  const icons = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.2 8.4h2.2V5h-2.7c-3.1 0-4.9 1.9-4.9 5.2v2.2H6v3.6h2.8v6h3.8v-6h3.1l.5-3.6h-3.6v-1.9c0-1 .3-2.1 1.6-2.1Z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.8 10.5 21.1 2h-1.7L13 9.4 7.9 2H2l7.7 11.2L2 22h1.7l6.8-7.9L16 22h5.9l-8.1-11.5Zm-2.4 2.8-.8-1.1-6.2-8.9h2.7l5 7.1.8 1.1 6.5 9.2h-2.7l-5.3-7.4Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3.7a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM3.2 9.7h3.6V21H3.2V9.7Zm6 0h3.4v1.6h.1c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.4 2.4 4.4 5.6v6h-3.6v-5.3c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V21H9.2V9.7Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 11.8a8.4 8.4 0 0 1-12.4 7.4L3.5 20.6l1.5-4.4A8.4 8.4 0 1 1 20.5 11.8Zm-8.4-6.6a6.6 6.6 0 0 0-5.6 10.1l.3.5-.9 2.5 2.6-.8.5.3a6.6 6.6 0 1 0 3.1-12.6Zm3.8 9.7c-.2.6-1.1 1.1-1.6 1.2-.4.1-.9.1-1.5-.1-.3-.1-.8-.2-1.4-.5-2.4-1-4-3.5-4.1-3.7-.1-.1-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.7.7 1.8.1.2.1.3 0 .5-.1.2-.2.3-.3.5l-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.1 1.4 1.8 1 .9 1.8 1.2 2.1 1.4.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1.3.1 1.7.8 2 1 .3.1.5.2.6.4 0 .1 0 .5-.2.9Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h18v14H3V5Zm2 2v.4l7 4.4 7-4.4V7H5Zm14 10V9.8l-7 4.4-7-4.4V17h14Z"/></svg>'
  };
  return icons[name] || "";
}

function articlePage(data, slug) {
  const article = published(data).find((item) => item.slug === slug);
  if (!article) return notFound(data);
  const seo = normalizedSeo(article);
  const related = published(data)
    .filter((item) => item.category === article.category && item.id !== article.id)
    .slice(0, 4);
  const articleUrl = `${siteUrl(data)}/news/${article.slug}`;
  const canonical = seo.canonical || articleUrl;
  const seoTitle = seo.title || article.title;
  const seoDescription = seo.description || article.excerpt;
  const socialTitle = seo.ogTitle || seoTitle;
  const socialDescription = seo.ogDescription || seoDescription;
  const socialImage = seo.ogImage || article.image;
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(socialTitle);
  const shareText = `${socialTitle}\n${articleUrl}`;
  const encodedShareText = encodeURIComponent(shareText);
  const encodedQuote = encodeURIComponent(`${socialTitle}\n${socialDescription}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": seo.schemaType || "NewsArticle",
    headline: seoTitle,
    description: seoDescription,
    keywords: listFromInput(seo.keywords).join(", "),
    image: [absoluteUrl(data, socialImage)],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: { "@type": "Person", name: article.author || data.settings.editor },
    publisher: {
      "@type": "Organization",
      name: data.settings.brandName,
      logo: { "@type": "ImageObject", url: absoluteUrl(data, "/assets/logo-card.png") }
    },
    mainEntityOfPage: canonical
  };

  const body = `<section class="container article-layout">
    <article class="article-main">
      <nav class="breadcrumb" aria-label="breadcrumb"><a href="/">হোম</a><span>/</span><a href="/category/${attr(article.category)}">${htmlEscape(categoryName(data, article.category))}</a></nav>
      <h1>${htmlEscape(article.title)}</h1>
      <p class="standfirst">${htmlEscape(article.excerpt)}</p>
      <div class="article-meta">
        <span>${htmlEscape(article.author || data.settings.editor)}</span>
        <span>প্রকাশ: ${fmtDate(article.publishedAt)} ${fmtTime(article.publishedAt)}</span>
        <span>আপডেট: ${fmtDate(article.updatedAt || article.publishedAt)} ${fmtTime(article.updatedAt || article.publishedAt)}</span>
      </div>
      <div class="share-bar" aria-label="সোশ্যাল মিডিয়ায় শেয়ার">
        <span>শেয়ার করুন</span>
        <a class="share facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedQuote}" target="_blank" rel="noopener noreferrer" aria-label="Facebook এ শেয়ার" data-share-popup="true" data-share-platform="facebook" data-share-text="${attr(shareText)}">${shareIcon("facebook")}</a>
        <a class="share twitter" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="X এ শেয়ার" data-share-popup="true" data-share-platform="twitter" data-share-text="${attr(shareText)}">${shareIcon("twitter")}</a>
        <a class="share linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn এ শেয়ার" data-share-popup="true" data-share-platform="linkedin" data-share-text="${attr(shareText)}">${shareIcon("linkedin")}</a>
        <a class="share whatsapp" href="https://wa.me/?text=${encodedShareText}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp এ শেয়ার" data-share-popup="true" data-share-platform="whatsapp" data-share-text="${attr(shareText)}">${shareIcon("whatsapp")}</a>
        <a class="share email" href="mailto:?subject=${encodedTitle}&body=${encodedShareText}" aria-label="ইমেইলে শেয়ার">${shareIcon("email")}</a>
        <button class="copy-link" type="button" data-copy-url="${attr(canonical)}" data-copy-text="${attr(shareText)}">লিংক কপি</button>
        <span class="share-status" role="status" aria-live="polite"></span>
        <div class="share-fallback" hidden>
          <strong>শেয়ার টেক্সট</strong>
          <textarea readonly aria-label="শেয়ার টেক্সট">${htmlEscape(shareText)}</textarea>
        </div>
      </div>
      <img class="article-photo" src="${attr(article.image)}" alt="${attr(article.imageAlt || article.title)}">
      <div class="article-body">
        ${article.body.map((paragraph) => `<p>${htmlEscape(paragraph)}</p>`).join("")}
      </div>
      <div class="tags">${article.tags.map((tag) => `<a href="/search?q=${encodeURIComponent(tag)}">#${htmlEscape(tag)}</a>`).join("")}</div>
      <section class="related-news">
        ${sectionTitle("আরও পড়ুন", `/category/${article.category}`)}
        <div class="story-strip">${related.map((item) => card(item, data)).join("")}</div>
      </section>
    </article>
    <aside class="right-rail">
      ${latestPopular(data)}
      ${adMarkup(data.ads.find((ad) => ad.position === "sidebar"), "tall")}
    </aside>
  </section>`;

  return layout(data, {
    title: `${seoTitle} | ${data.settings.brandName}`,
    description: seoDescription,
    canonical,
    image: socialImage,
    keywords: seo.keywords,
    author: article.author || data.settings.editor,
    robots: robotsContent(seo),
    ogTitle: socialTitle,
    ogDescription: socialDescription,
    twitterTitle: seo.twitterTitle || socialTitle,
    twitterDescription: seo.twitterDescription || socialDescription,
    type: "article",
    jsonLd
  }, body);
}

function searchPage(data, params) {
  const q = (params.get("q") || "").trim();
  const district = (params.get("district") || "").trim();
  const division = (params.get("division") || "").trim();
  const terms = [q, district, division].filter(Boolean);
  const items = published(data).filter((article) => {
    if (!terms.length) return true;
    const haystack = `${article.title} ${article.excerpt} ${article.body.join(" ")} ${article.tags.join(" ")} ${article.district}`.toLowerCase();
    return terms.every((term) => haystack.includes(term.toLowerCase()));
  });
  const label = terms.length ? terms.join(" ") : "সব সংবাদ";
  const body = `<section class="container page-heading">
      <h1>অনুসন্ধান: ${htmlEscape(label)}</h1>
      <p>${items.length.toLocaleString("bn-BD")}টি ফলাফল পাওয়া গেছে।</p>
    </section>
    <section class="container listing-layout">
      <div class="listing-grid">${items.map((article) => cardLarge(article, data)).join("") || `<p class="empty">কোনো সংবাদ পাওয়া যায়নি।</p>`}</div>
      <aside class="right-rail">${latestPopular(data)}</aside>
    </section>`;
  return layout(data, {
    title: `অনুসন্ধান | ${data.settings.brandName}`,
    description: `${label} সম্পর্কিত সংবাদ অনুসন্ধানের ফলাফল।`,
    canonical: `${siteUrl(data)}/search`
  }, body);
}

function archivePage(data) {
  const items = published(data);
  const body = `<section class="container page-heading">
      <h1>আর্কাইভ</h1>
      <p>তারিখ অনুযায়ী প্রকাশিত সংবাদ।</p>
    </section>
    <section class="container archive-list">
      ${items.map((article) => `<article>
        <time datetime="${attr(article.publishedAt)}">${fmtDate(article.publishedAt)} ${fmtTime(article.publishedAt)}</time>
        <a href="/news/${attr(article.slug)}">${htmlEscape(article.title)}</a>
        <span>${htmlEscape(categoryName(data, article.category))}</span>
      </article>`).join("")}
    </section>`;
  return layout(data, {
    title: `আর্কাইভ | ${data.settings.brandName}`,
    description: "প্রকাশিত সকল সংবাদের আর্কাইভ।",
    canonical: `${siteUrl(data)}/archive`
  }, body);
}

function adminPage(data) {
  const body = `<section class="admin-shell">
    <header class="admin-head">
      <div>
        <p>CMS</p>
        <h1>${htmlEscape(data.settings.brandName)} কনটেন্ট ম্যানেজমেন্ট</h1>
      </div>
      <a href="/" target="_blank" rel="noreferrer">সাইট দেখুন</a>
    </header>
    <section class="admin-stats" id="adminStats"></section>
    <section class="admin-layout">
      <form class="editor-panel" id="articleForm">
        <input type="hidden" id="articleId">
        <label>শিরোনাম<input id="title" required maxlength="140"></label>
        <label>স্লাগ<input id="slug" maxlength="180"></label>
        <label>সংক্ষিপ্ত বিবরণ<textarea id="excerpt" required rows="3"></textarea></label>
        <label>মূল লেখা<textarea id="body" required rows="9"></textarea></label>
        <div class="form-grid">
          <label>বিভাগ<select id="category"></select></label>
          <label>জেলা<input id="district"></label>
          <label>লেখক<input id="author"></label>
          <label>ট্যাগ<input id="tags" placeholder="কমা দিয়ে লিখুন"></label>
        </div>
        <label>ছবি URL<input id="image"></label>
        <div class="upload-widget">
          <input id="imageUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <button type="button" id="uploadImageButton">এক ক্লিকে ছবি আপলোড</button>
          <span id="uploadStatus">JPG, PNG, WEBP বা GIF; সর্বোচ্চ ৩MB</span>
          <img id="imagePreview" alt="ছবির প্রিভিউ" hidden>
        </div>
        <label>ছবির alt text<input id="imageAlt"></label>
        <section class="seo-panel">
          <div class="seo-panel-head">
            <div>
              <p>SEO</p>
              <h2>গুগল ইনডেক্স ও সোশ্যাল প্রিভিউ</h2>
            </div>
            <button type="button" id="aiSeoButton">AI SEO তৈরি করুন</button>
          </div>
          <div class="seo-score" id="seoScoreBox">
            <strong>০%</strong>
            <span>SEO স্কোর</span>
          </div>
          <label>SEO Title<input id="seoTitle" maxlength="70" placeholder="৫০-৬০ অক্ষরের মধ্যে রাখুন"></label>
          <label>Meta Description<textarea id="seoDescription" rows="3" maxlength="170" placeholder="১২০-১৬০ অক্ষরের সার্চ স্নিপেট"></textarea></label>
          <div class="form-grid">
            <label>Focus Keyword<input id="focusKeyword"></label>
            <label>SEO Keywords<input id="seoKeywords" placeholder="কমা দিয়ে লিখুন"></label>
          </div>
          <label>Canonical URL<input id="canonicalUrl" placeholder="খালি রাখলে পোস্টের নিজের URL ব্যবহার হবে"></label>
          <div class="form-grid">
            <label>OG Title<input id="ogTitle"></label>
            <label>OG Image<input id="ogImage" placeholder="/assets/news-economy.png"></label>
          </div>
          <label>OG Description<textarea id="ogDescription" rows="2"></textarea></label>
          <div class="form-grid">
            <label>Twitter Title<input id="twitterTitle"></label>
            <label>Twitter Description<input id="twitterDescription"></label>
          </div>
          <div class="form-grid">
            <label>Schema Type
              <select id="schemaType">
                <option value="NewsArticle">NewsArticle</option>
                <option value="Article">Article</option>
                <option value="BlogPosting">BlogPosting</option>
              </select>
            </label>
            <label>Max Image Preview
              <select id="maxImagePreview">
                <option value="large">large</option>
                <option value="standard">standard</option>
                <option value="none">none</option>
              </select>
            </label>
            <label>Max Snippet<input id="maxSnippet" value="-1"></label>
            <label>Max Video Preview<input id="maxVideoPreview" value="-1"></label>
          </div>
          <div class="toggle-row seo-toggles">
            <label><input type="checkbox" id="robotsIndex" checked> index</label>
            <label><input type="checkbox" id="robotsFollow" checked> follow</label>
            <label><input type="checkbox" id="includeInSitemap" checked> sitemap</label>
            <label><input type="checkbox" id="noarchive"> noarchive</label>
            <label><input type="checkbox" id="nosnippet"> nosnippet</label>
            <label><input type="checkbox" id="noimageindex"> noimageindex</label>
          </div>
          <ul class="seo-checklist" id="seoChecklist"></ul>
        </section>
        <div class="toggle-row">
          <label><input type="checkbox" id="featured"> ফিচার্ড</label>
          <label><input type="checkbox" id="lead"> লিড নিউজ</label>
          <label><input type="checkbox" id="video"> ভিডিও</label>
          <label><input type="checkbox" id="published" checked> প্রকাশিত</label>
        </div>
        <div class="button-row">
          <button type="submit">সংরক্ষণ</button>
          <button type="button" id="newArticle">নতুন</button>
        </div>
      </form>
      <div class="content-panel">
        <div class="panel-toolbar">
          <input id="adminSearch" type="search" placeholder="শিরোনাম খুঁজুন">
          <select id="adminFilter"></select>
        </div>
        <div id="articleList" class="admin-list"></div>
      </div>
    </section>
    <section class="settings-panel">
      <h2>সাইট সেটিংস</h2>
      <form id="settingsForm" class="settings-grid">
        <label>নাম<input id="brandName"></label>
        <label>ডোমেইন<input id="brandDomain"></label>
        <label>ট্যাগলাইন<input id="tagline"></label>
        <label>SEO বিবরণ<textarea id="description" rows="3"></textarea></label>
        <label>ইমেইল<input id="email"></label>
        <label>ফোন<input id="phone"></label>
        <button type="submit">সেটিংস সংরক্ষণ</button>
      </form>
    </section>
  </section>`;

  return `${head(data, {
    title: `CMS | ${data.settings.brandName}`,
    description: "News CMS",
    canonical: `${siteUrl(data)}/admin`
  })}
<body class="admin-page">
  ${body}
  <script src="/admin.js?v=20260608-share3" defer></script>
</body>
</html>`;
}

function footer(data) {
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <a class="footer-brand" href="/">${htmlEscape(data.settings.brandName)}</a>
        <p>${htmlEscape(data.settings.description)}</p>
      </div>
      <div>
        <h2>বিভাগ</h2>
        <div class="footer-links">${data.categories.slice(0, 9).map((cat) => `<a href="/category/${attr(cat.slug)}">${htmlEscape(cat.name)}</a>`).join("")}</div>
      </div>
      <div>
        <h2>যোগাযোগ</h2>
        <p>${htmlEscape(data.settings.address)}<br>${htmlEscape(data.settings.email)}<br>${htmlEscape(data.settings.phone)}</p>
      </div>
    </div>
    <div class="copyright">© ${new Date().getFullYear()} ${htmlEscape(data.settings.brandName)}. সর্বস্বত্ব সংরক্ষিত।</div>
  </footer>`;
}

function notFound(data) {
  return layout(data, {
    title: `পৃষ্ঠা পাওয়া যায়নি | ${data.settings.brandName}`,
    description: "অনুরোধ করা পৃষ্ঠা পাওয়া যায়নি।",
    canonical: siteUrl(data)
  }, `<section class="container page-heading"><h1>পৃষ্ঠা পাওয়া যায়নি</h1><p>ঠিকানা পরীক্ষা করে আবার চেষ্টা করুন।</p></section>`);
}

function sitemap(data) {
  const base = siteUrl(data);
  const urls = [
    ["", new Date().toISOString()],
    ["archive", new Date().toISOString()],
    ...data.categories.map((cat) => [`category/${cat.slug}`, new Date().toISOString()]),
    ...published(data).filter(isIndexableArticle).map((article) => [`news/${article.slug}`, article.updatedAt || article.publishedAt])
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc, lastmod]) => `  <url>
    <loc>${htmlEscape(`${base}/${loc}`.replace(/\/$/, ""))}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
  </url>`).join("\n")}
</urlset>`;
}

function rss(data) {
  const base = siteUrl(data);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${htmlEscape(data.settings.brandName)}</title>
    <link>${htmlEscape(base)}</link>
    <description>${htmlEscape(data.settings.description)}</description>
    <language>bn-BD</language>
    ${published(data).slice(0, 20).map((article) => `<item>
      <title>${htmlEscape(article.title)}</title>
      <link>${htmlEscape(`${base}/news/${article.slug}`)}</link>
      <guid>${htmlEscape(`${base}/news/${article.slug}`)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <description>${htmlEscape(article.excerpt)}</description>
    </item>`).join("")}
  </channel>
</rss>`;
}

function manifest(data) {
  return JSON.stringify({
    name: data.settings.brandName,
    short_name: data.settings.brandName,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#138547",
    lang: "bn-BD",
    icons: [
      { src: "/assets/logo-card.png", sizes: "512x512", type: "image/png" }
    ]
  }, null, 2);
}

function send(res, status, body, type = "text/html; charset=utf-8") {
  const noCache = type.startsWith("text/html") || type.startsWith("text/css") || type.startsWith("application/javascript") || type.startsWith("application/json");
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": noCache ? "no-cache" : "public, max-age=3600"
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname.replace(/^\/+/, "")));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeSeoInput(input = {}, current = {}) {
  const existing = { ...seoDefaults(), ...(current.seo || {}) };
  const seoInput = input.seo || {};
  const boolValue = (key, fallback) => (
    Object.prototype.hasOwnProperty.call(seoInput, key) ? Boolean(seoInput[key]) : fallback
  );

  return {
    title: String(seoInput.title ?? existing.title ?? "").trim(),
    description: String(seoInput.description ?? existing.description ?? "").trim(),
    focusKeyword: String(seoInput.focusKeyword ?? existing.focusKeyword ?? "").trim(),
    keywords: listFromInput(seoInput.keywords ?? existing.keywords),
    canonical: String(seoInput.canonical ?? existing.canonical ?? "").trim(),
    robotsIndex: boolValue("robotsIndex", existing.robotsIndex !== false),
    robotsFollow: boolValue("robotsFollow", existing.robotsFollow !== false),
    noarchive: boolValue("noarchive", Boolean(existing.noarchive)),
    nosnippet: boolValue("nosnippet", Boolean(existing.nosnippet)),
    noimageindex: boolValue("noimageindex", Boolean(existing.noimageindex)),
    maxSnippet: String(seoInput.maxSnippet ?? existing.maxSnippet ?? "-1").trim() || "-1",
    maxImagePreview: ["large", "standard", "none"].includes(seoInput.maxImagePreview)
      ? seoInput.maxImagePreview
      : (existing.maxImagePreview || "large"),
    maxVideoPreview: String(seoInput.maxVideoPreview ?? existing.maxVideoPreview ?? "-1").trim() || "-1",
    includeInSitemap: boolValue("includeInSitemap", existing.includeInSitemap !== false),
    ogTitle: String(seoInput.ogTitle ?? existing.ogTitle ?? "").trim(),
    ogDescription: String(seoInput.ogDescription ?? existing.ogDescription ?? "").trim(),
    ogImage: String(seoInput.ogImage ?? existing.ogImage ?? "").trim(),
    twitterTitle: String(seoInput.twitterTitle ?? existing.twitterTitle ?? "").trim(),
    twitterDescription: String(seoInput.twitterDescription ?? existing.twitterDescription ?? "").trim(),
    schemaType: ["NewsArticle", "Article", "BlogPosting"].includes(seoInput.schemaType)
      ? seoInput.schemaType
      : (existing.schemaType || "NewsArticle"),
    seoScore: Number(seoInput.seoScore ?? existing.seoScore ?? 0),
    aiGeneratedAt: String(seoInput.aiGeneratedAt ?? existing.aiGeneratedAt ?? "").trim()
  };
}

function normalizeArticle(input, current = {}) {
  const now = new Date().toISOString();
  const title = String(input.title || current.title || "").trim();
  const body = Array.isArray(input.body)
    ? input.body
    : String(input.body || current.body?.join("\n\n") || "")
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
  return {
    id: current.id || `a${Date.now()}`,
    slug: slugify(input.slug || title || current.slug),
    title,
    excerpt: String(input.excerpt || current.excerpt || "").trim(),
    body,
    category: input.category || current.category || "national",
    district: input.district || current.district || "ঢাকা",
    author: input.author || current.author || "নিউজ ডেস্ক",
    image: input.image || current.image || "/assets/news-economy.png",
    imageAlt: input.imageAlt || current.imageAlt || title,
    tags: Array.isArray(input.tags)
      ? input.tags
      : String(input.tags || current.tags?.join(",") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    status: input.status || (input.published === false ? "draft" : "published"),
    featured: Boolean(input.featured),
    lead: Boolean(input.lead),
    video: Boolean(input.video),
    views: Number(input.views ?? current.views ?? 0),
    seo: normalizeSeoInput(input, current),
    publishedAt: current.publishedAt || now,
    updatedAt: now
  };
}

function imageExtFromType(type) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  return map[type] || "";
}

function saveUploadedImage(payload = {}) {
  const type = String(payload.type || "").toLowerCase();
  const ext = imageExtFromType(type);
  if (!ext) {
    return { error: "Only JPG, PNG, WEBP or GIF images are allowed.", status: 415 };
  }

  const base64 = String(payload.data || "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!base64) {
    return { error: "Image data is missing.", status: 400 };
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
    return { error: "Image must be 3MB or smaller.", status: 413 };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const baseName = safeFilePart(path.parse(payload.name || "image").name);
  const fileName = `${Date.now()}-${baseName}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    url: `/assets/uploads/${fileName}`,
    name: fileName,
    size: buffer.length,
    type
  };
}

async function handleApi(req, res, url, data) {
  if (req.method === "GET" && url.pathname === "/api/content") {
    send(res, 200, JSON.stringify(data), "application/json; charset=utf-8");
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/uploads") {
    const payload = await readJson(req);
    const uploaded = saveUploadedImage(payload);
    if (uploaded.error) {
      send(res, uploaded.status || 400, JSON.stringify({ error: uploaded.error }), "application/json; charset=utf-8");
      return true;
    }
    send(res, 201, JSON.stringify(uploaded), "application/json; charset=utf-8");
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/articles") {
    const payload = await readJson(req);
    const article = normalizeArticle(payload);
    if (article.lead) data.articles.forEach((item) => { item.lead = false; });
    data.articles.unshift(article);
    saveData(data);
    send(res, 201, JSON.stringify(article), "application/json; charset=utf-8");
    return true;
  }
  const articleMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
  if (articleMatch && (req.method === "PUT" || req.method === "DELETE")) {
    const id = decodeURIComponent(articleMatch[1]);
    const index = data.articles.findIndex((article) => article.id === id);
    if (index === -1) {
      send(res, 404, JSON.stringify({ error: "Not found" }), "application/json; charset=utf-8");
      return true;
    }
    if (req.method === "DELETE") {
      const [removed] = data.articles.splice(index, 1);
      saveData(data);
      send(res, 200, JSON.stringify(removed), "application/json; charset=utf-8");
      return true;
    }
    const payload = await readJson(req);
    const article = normalizeArticle(payload, data.articles[index]);
    if (article.lead) data.articles.forEach((item) => { item.lead = false; });
    data.articles[index] = article;
    saveData(data);
    send(res, 200, JSON.stringify(article), "application/json; charset=utf-8");
    return true;
  }
  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const payload = await readJson(req);
    data.settings = { ...data.settings, ...payload };
    saveData(data);
    send(res, 200, JSON.stringify(data.settings), "application/json; charset=utf-8");
    return true;
  }
  return false;
}

async function requestHandler(req, res) {
  try {
    const data = loadData();
    const url = new URL(req.url, siteUrl(data));
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/assets/") || pathname === "/styles.css" || pathname === "/site.js" || pathname === "/admin.js") {
      if (serveStatic(req, res, pathname)) return;
    }
    if (pathname === "/api/content" || pathname === "/api/uploads" || pathname.startsWith("/api/articles") || pathname === "/api/settings") {
      if (await handleApi(req, res, url, data)) return;
    }
    if (req.method !== "GET") {
      send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
      return;
    }
    if (pathname === "/") send(res, 200, homePage(data));
    else if (pathname === "/admin") send(res, 200, adminPage(data));
    else if (pathname === "/sitemap.xml") send(res, 200, sitemap(data), "application/xml; charset=utf-8");
    else if (pathname === "/rss.xml") send(res, 200, rss(data), "application/xml; charset=utf-8");
    else if (pathname === "/robots.txt") send(res, 200, `User-agent: *\nAllow: /\nSitemap: ${siteUrl(data)}/sitemap.xml\n`, "text/plain; charset=utf-8");
    else if (pathname === "/manifest.webmanifest") send(res, 200, manifest(data), "application/manifest+json; charset=utf-8");
    else if (pathname === "/search") send(res, 200, searchPage(data, url.searchParams));
    else if (pathname === "/archive") send(res, 200, archivePage(data));
    else if (pathname.startsWith("/category/")) send(res, 200, categoryPage(data, pathname.split("/")[2]));
    else if (pathname.startsWith("/news/")) send(res, 200, articlePage(data, pathname.split("/")[2]));
    else send(res, 404, notFound(data));
  } catch (error) {
    console.error(error);
    send(res, 500, "Internal server error", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`SubarnoNews CMS running at http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;
