let state = {
  articles: [],
  categories: [],
  settings: {}
};

const $ = (selector) => document.querySelector(selector);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
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
  $("#featured").checked = Boolean(article?.featured);
  $("#lead").checked = Boolean(article?.lead);
  $("#video").checked = Boolean(article?.video);
  $("#published").checked = article?.status !== "draft";
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
    status: $("#published").checked ? "published" : "draft"
  };
}

$("#title").addEventListener("input", () => {
  if (!$("#articleId").value) $("#slug").value = slugify($("#title").value);
});

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
