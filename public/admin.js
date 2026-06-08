let state = {
  articles: [],
  categories: [],
  settings: {}
};

const UPLOAD_WIDTH = 900;
const UPLOAD_HEIGHT = 520;
const MAX_UPLOAD_BYTES = 300 * 1024;

const $ = (selector) => document.querySelector(selector);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, max) {
  const text = cleanText(value);
  return text.length > max ? text.slice(0, max - 1).trim() : text;
}

function wordsFrom(value) {
  const stopWords = new Set([
    "এবং", "করে", "হবে", "হয়েছে", "হয়েছে", "জন্য", "নিয়ে", "থেকে", "সঙ্গে", "করতে",
    "বলেন", "জানান", "হয়", "হয়", "এই", "ওপর", "আরও", "একটি", "তারা", "তার", "এর",
    "the", "and", "for", "with", "from", "this", "that"
  ]);
  return cleanText(value)
    .toLowerCase()
    .match(/[\u0980-\u09ffa-z0-9]+/g)?.filter((word) => word.length > 2 && !stopWords.has(word)) || [];
}

function extractKeywords() {
  const weighted = `${$("#title").value} ${$("#title").value} ${$("#excerpt").value} ${$("#body").value}`;
  const counts = new Map();
  wordsFrom(weighted).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .slice(0, 8);
}

function seoValues() {
  return {
    title: $("#seoTitle")?.value || "",
    description: $("#seoDescription")?.value || "",
    focusKeyword: $("#focusKeyword")?.value || "",
    keywords: $("#seoKeywords")?.value || "",
    canonical: $("#canonicalUrl")?.value || "",
    robotsIndex: $("#robotsIndex")?.checked,
    robotsFollow: $("#robotsFollow")?.checked,
    includeInSitemap: $("#includeInSitemap")?.checked,
    noarchive: $("#noarchive")?.checked,
    nosnippet: $("#nosnippet")?.checked,
    noimageindex: $("#noimageindex")?.checked,
    maxSnippet: $("#maxSnippet")?.value || "-1",
    maxImagePreview: $("#maxImagePreview")?.value || "large",
    maxVideoPreview: $("#maxVideoPreview")?.value || "-1",
    ogTitle: $("#ogTitle")?.value || "",
    ogDescription: $("#ogDescription")?.value || "",
    ogImage: $("#ogImage")?.value || "",
    twitterTitle: $("#twitterTitle")?.value || "",
    twitterDescription: $("#twitterDescription")?.value || "",
    schemaType: $("#schemaType")?.value || "NewsArticle"
  };
}

function computeSeoStatus() {
  const seo = seoValues();
  const pageText = cleanText(`${$("#title").value} ${$("#excerpt").value} ${$("#body").value}`).toLowerCase();
  const focus = cleanText(seo.focusKeyword).toLowerCase();
  const canonicalOk = !seo.canonical || /^https?:\/\/[^ ]+\.[^ ]+/.test(seo.canonical);
  const checks = [
    ["SEO title ৩০-৬৫ অক্ষরের মধ্যে", seo.title.length >= 30 && seo.title.length <= 65],
    ["Meta description ৮০-১৬০ অক্ষরের মধ্যে", seo.description.length >= 80 && seo.description.length <= 160],
    ["Focus keyword আছে", Boolean(focus)],
    ["Focus keyword title/description/body-তে আছে", Boolean(focus && `${seo.title} ${seo.description} ${pageText}`.toLowerCase().includes(focus))],
    ["SEO keywords ৩টির বেশি", seo.keywords.split(",").filter((item) => item.trim()).length >= 3],
    ["Slug তৈরি আছে", Boolean($("#slug").value.trim())],
    ["Image alt text আছে", Boolean($("#imageAlt").value.trim())],
    ["Robots index + follow চালু", Boolean(seo.robotsIndex && seo.robotsFollow)],
    ["Sitemap include চালু", Boolean(seo.includeInSitemap)],
    ["Canonical URL সঠিক বা খালি", canonicalOk],
    ["Open Graph title/description/image আছে", Boolean(seo.ogTitle && seo.ogDescription && seo.ogImage)],
    ["Structured data NewsArticle", seo.schemaType === "NewsArticle"],
    ["মূল লেখা ৩০০+ অক্ষর", cleanText($("#body").value).length >= 300]
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return { checks, score: Math.round((passed / checks.length) * 100) };
}

function renderSeoScore() {
  const { checks, score } = computeSeoStatus();
  const box = $("#seoScoreBox");
  if (box) {
    box.classList.toggle("good", score >= 85);
    box.innerHTML = `<strong>${Number(score).toLocaleString("bn-BD")}%</strong><span>SEO স্কোর</span>`;
  }
  const checklist = $("#seoChecklist");
  if (checklist) {
    checklist.innerHTML = checks
      .map(([label, ok]) => `<li class="${ok ? "pass" : ""}">${ok ? "✓" : "•"} ${label}</li>`)
      .join("");
  }
  return score;
}

function runAiSeo() {
  const title = cleanText($("#title").value);
  const excerpt = cleanText($("#excerpt").value);
  const body = cleanText($("#body").value);
  const keywords = extractKeywords();
  const focus = keywords[0] || title.split(/\s+/).slice(0, 2).join(" ");
  const descriptionSource = excerpt || body;
  const seoTitle = truncateText(title, 62);
  let description = truncateText(descriptionSource, 155);
  if (focus && description && !description.toLowerCase().includes(focus.toLowerCase())) {
    description = truncateText(`${focus}: ${description}`, 155);
  }

  if (title && !$("#slug").value.trim()) $("#slug").value = slugify(title);
  if (!$("#tags").value.trim() && keywords.length) $("#tags").value = keywords.slice(0, 5).join(", ");
  if (!$("#imageAlt").value.trim()) $("#imageAlt").value = title;
  $("#seoScoreBox").dataset.aiGeneratedAt = new Date().toISOString();

  $("#seoTitle").value = seoTitle;
  $("#seoDescription").value = description;
  $("#focusKeyword").value = focus;
  $("#seoKeywords").value = keywords.slice(0, 6).join(", ");
  $("#canonicalUrl").value = "";
  $("#ogTitle").value = seoTitle;
  $("#ogDescription").value = description;
  $("#ogImage").value = $("#image").value || "/assets/news-economy.png";
  $("#twitterTitle").value = seoTitle;
  $("#twitterDescription").value = description;
  $("#schemaType").value = "NewsArticle";
  $("#maxImagePreview").value = "large";
  $("#maxSnippet").value = "-1";
  $("#maxVideoPreview").value = "-1";
  $("#robotsIndex").checked = true;
  $("#robotsFollow").checked = true;
  $("#includeInSitemap").checked = true;
  $("#noarchive").checked = false;
  $("#nosnippet").checked = false;
  $("#noimageindex").checked = false;

  renderSeoScore();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function setUploadStatus(message, kind = "") {
  const status = $("#uploadStatus");
  if (!status) return;
  status.textContent = message;
  status.className = kind;
}

function updateImagePreview(url) {
  const preview = $("#imagePreview");
  if (!preview) return;
  if (url) {
    preview.src = url;
    preview.hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function normalizeImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const source = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = UPLOAD_WIDTH;
  canvas.height = UPLOAD_HEIGHT;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, UPLOAD_WIDTH, UPLOAD_HEIGHT);

  const scale = Math.max(UPLOAD_WIDTH / source.naturalWidth, UPLOAD_HEIGHT / source.naturalHeight);
  const drawWidth = Math.round(source.naturalWidth * scale);
  const drawHeight = Math.round(source.naturalHeight * scale);
  const drawX = Math.round((UPLOAD_WIDTH - drawWidth) / 2);
  const drawY = Math.round((UPLOAD_HEIGHT - drawHeight) / 2);
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);

  let blob = null;
  let quality = 0.82;
  while (quality >= 0.38) {
    blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.08;
  }

  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image could not be compressed under 300KB.");
  }

  const compressedDataUrl = await readFileAsDataUrl(blob);
  return {
    data: compressedDataUrl.split(",")[1] || "",
    name: `${file.name.replace(/\.[^.]+$/, "")}-900x520.jpg`,
    size: blob.size,
    type: "image/jpeg",
    width: UPLOAD_WIDTH,
    height: UPLOAD_HEIGHT
  };
}

async function uploadImageFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    setUploadStatus("শুধু JPG, PNG, WEBP বা GIF আপলোড করা যাবে", "error");
    return;
  }

  setUploadStatus("ছবি 900x520px ও 300KB-এর নিচে আনা হচ্ছে...", "");
  try {
    const processed = await normalizeImageFile(file);
    setUploadStatus(`কমপ্রেস হয়েছে: ${(processed.size / 1024).toFixed(0)}KB, আপলোড হচ্ছে...`, "");
    const uploaded = await api("/api/uploads", {
      method: "POST",
      body: JSON.stringify({
        name: processed.name,
        type: processed.type,
        data: processed.data,
        width: processed.width,
        height: processed.height
      })
    });
    $("#image").value = uploaded.url;
    if (!$("#ogImage").value.trim()) $("#ogImage").value = uploaded.url;
    else $("#ogImage").value = uploaded.url;
    if (!$("#imageAlt").value.trim()) $("#imageAlt").value = $("#title").value || file.name.replace(/\.[^.]+$/, "");
    updateImagePreview(uploaded.url);
    setUploadStatus(`আপলোড সম্পন্ন: ${uploaded.width}x${uploaded.height}px, ${(uploaded.size / 1024).toFixed(0)}KB`, "ok");
    renderSeoScore();
  } catch (error) {
    setUploadStatus("ছবি 300KB-এর নিচে আনা যায়নি, অন্য ছবি দিন", "error");
  }
}

async function load() {
  state = await api("/api/content");
  fillOptions();
  renderStats();
  renderList();
  fillSettings();
}

function fillOptions() {
  const category = $("#category");
  const adminFilter = $("#adminFilter");
  category.innerHTML = state.categories.map((item) => `<option value="${item.slug}">${item.name}</option>`).join("");
  adminFilter.innerHTML = `<option value="">সব বিভাগ</option>${state.categories.map((item) => `<option value="${item.slug}">${item.name}</option>`).join("")}`;
}

function renderStats() {
  const published = state.articles.filter((item) => item.status === "published").length;
  const drafts = state.articles.length - published;
  const videos = state.articles.filter((item) => item.video).length;
  $("#adminStats").innerHTML = [
    ["মোট সংবাদ", state.articles.length],
    ["প্রকাশিত", published],
    ["ড্রাফট", drafts],
    ["ভিডিও", videos]
  ].map(([label, value]) => `<div><strong>${Number(value).toLocaleString("bn-BD")}</strong><span>${label}</span></div>`).join("");
}

function renderList() {
  const query = $("#adminSearch").value.trim().toLowerCase();
  const filter = $("#adminFilter").value;
  const items = state.articles.filter((article) => {
    const matchesQuery = !query || article.title.toLowerCase().includes(query);
    const matchesFilter = !filter || article.category === filter;
    return matchesQuery && matchesFilter;
  });

  $("#articleList").innerHTML = items.map((article) => {
    const category = state.categories.find((item) => item.slug === article.category)?.name || article.category;
    return `<article class="admin-item">
      <strong>${article.title}</strong>
      <span>${category} | ${article.status === "published" ? "প্রকাশিত" : "ড্রাফট"} | ${new Date(article.publishedAt).toLocaleString("bn-BD")}</span>
      <div class="button-row">
        <button type="button" data-edit="${article.id}">সম্পাদনা</button>
        <a href="/news/${article.slug}" target="_blank" rel="noreferrer">দেখুন</a>
        <button type="button" data-delete="${article.id}">মুছুন</button>
      </div>
    </article>`;
  }).join("");
}

function fillArticle(article) {
  const seo = article?.seo || {};
  $("#articleId").value = article?.id || "";
  $("#title").value = article?.title || "";
  $("#slug").value = article?.slug || "";
  $("#excerpt").value = article?.excerpt || "";
  $("#body").value = Array.isArray(article?.body) ? article.body.join("\n\n") : "";
  $("#category").value = article?.category || state.categories[0]?.slug || "national";
  $("#district").value = article?.district || "ঢাকা";
  $("#author").value = article?.author || "নিউজ ডেস্ক";
  $("#tags").value = article?.tags?.join(", ") || "";
  $("#image").value = article?.image || "/assets/news-economy.png";
  $("#imageAlt").value = article?.imageAlt || "";
  updateImagePreview($("#image").value);
  setUploadStatus("Auto 900x520px JPG, সর্বোচ্চ 300KB", "");
  $("#seoTitle").value = seo.title || "";
  $("#seoDescription").value = seo.description || "";
  $("#focusKeyword").value = seo.focusKeyword || "";
  $("#seoKeywords").value = Array.isArray(seo.keywords) ? seo.keywords.join(", ") : (seo.keywords || "");
  $("#canonicalUrl").value = seo.canonical || "";
  $("#ogTitle").value = seo.ogTitle || "";
  $("#ogDescription").value = seo.ogDescription || "";
  $("#ogImage").value = seo.ogImage || "";
  $("#twitterTitle").value = seo.twitterTitle || "";
  $("#twitterDescription").value = seo.twitterDescription || "";
  $("#schemaType").value = seo.schemaType || "NewsArticle";
  $("#maxImagePreview").value = seo.maxImagePreview || "large";
  $("#maxSnippet").value = seo.maxSnippet || "-1";
  $("#maxVideoPreview").value = seo.maxVideoPreview || "-1";
  $("#robotsIndex").checked = seo.robotsIndex !== false;
  $("#robotsFollow").checked = seo.robotsFollow !== false;
  $("#includeInSitemap").checked = seo.includeInSitemap !== false;
  $("#noarchive").checked = Boolean(seo.noarchive);
  $("#nosnippet").checked = Boolean(seo.nosnippet);
  $("#noimageindex").checked = Boolean(seo.noimageindex);
  $("#featured").checked = Boolean(article?.featured);
  $("#lead").checked = Boolean(article?.lead);
  $("#video").checked = Boolean(article?.video);
  $("#published").checked = article?.status !== "draft";
  $("#seoScoreBox").dataset.aiGeneratedAt = seo.aiGeneratedAt || "";
  renderSeoScore();
}

function fillSettings() {
  $("#brandName").value = state.settings.brandName || "";
  $("#brandDomain").value = state.settings.brandDomain || "";
  $("#tagline").value = state.settings.tagline || "";
  $("#description").value = state.settings.description || "";
  $("#email").value = state.settings.email || "";
  $("#phone").value = state.settings.phone || "";
}

function articlePayload() {
  const seoScore = renderSeoScore();
  return {
    title: $("#title").value,
    slug: $("#slug").value || slugify($("#title").value),
    excerpt: $("#excerpt").value,
    body: $("#body").value,
    category: $("#category").value,
    district: $("#district").value,
    author: $("#author").value,
    tags: $("#tags").value,
    image: $("#image").value,
    imageAlt: $("#imageAlt").value,
    featured: $("#featured").checked,
    lead: $("#lead").checked,
    video: $("#video").checked,
    status: $("#published").checked ? "published" : "draft",
    seo: {
      ...seoValues(),
      keywords: $("#seoKeywords").value,
      seoScore,
      aiGeneratedAt: $("#seoScoreBox").dataset.aiGeneratedAt || ""
    }
  };
}

$("#title").addEventListener("input", () => {
  if (!$("#articleId").value) $("#slug").value = slugify($("#title").value);
  renderSeoScore();
});

$("#image").addEventListener("input", () => {
  updateImagePreview($("#image").value.trim());
  renderSeoScore();
});

$("#uploadImageButton").addEventListener("click", () => $("#imageUpload").click());
$("#imageUpload").addEventListener("change", (event) => {
  uploadImageFile(event.target.files?.[0]);
  event.target.value = "";
});

$("#aiSeoButton").addEventListener("click", runAiSeo);
$("#articleForm").addEventListener("input", renderSeoScore);
$("#articleForm").addEventListener("change", renderSeoScore);

$("#articleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#articleId").value;
  const payload = articlePayload();
  if (id) {
    await api(`/api/articles/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await api("/api/articles", { method: "POST", body: JSON.stringify(payload) });
  }
  await load();
  fillArticle(null);
});

$("#newArticle").addEventListener("click", () => fillArticle(null));
$("#adminSearch").addEventListener("input", renderList);
$("#adminFilter").addEventListener("change", renderList);

$("#articleList").addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    fillArticle(state.articles.find((article) => article.id === editId));
  }
  if (deleteId) {
    await api(`/api/articles/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
    await load();
    fillArticle(null);
  }
});

$("#settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify({
      brandName: $("#brandName").value,
      brandDomain: $("#brandDomain").value,
      tagline: $("#tagline").value,
      description: $("#description").value,
      email: $("#email").value,
      phone: $("#phone").value
    })
  });
  await load();
});

load().then(() => fillArticle(null));
