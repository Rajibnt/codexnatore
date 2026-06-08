document.querySelectorAll("[data-tabs]").forEach((tabs) => {
  const buttons = tabs.querySelectorAll("[data-tab-button]");
  const panels = tabs.querySelectorAll("[data-tab-panel]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tabButton;
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === target));
    });
  });
});

const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector("#navMenu");
if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
}

const navSearch = document.querySelector(".nav-search");
if (navSearch) {
  const input = navSearch.querySelector("input");
  navSearch.addEventListener("submit", (event) => {
    if (!navSearch.classList.contains("open") && !input.value.trim() && window.matchMedia("(min-width: 861px)").matches) {
      event.preventDefault();
      navSearch.classList.add("open");
      input.focus();
    }
  });
  input.addEventListener("blur", () => {
    if (!input.value.trim()) navSearch.classList.remove("open");
  });
}

const shareStatus = document.querySelector(".share-status");
const shareFallback = document.querySelector(".share-fallback");

function setShareStatus(message) {
  if (!shareStatus) return;
  shareStatus.textContent = message;
  window.clearTimeout(setShareStatus.timer);
  setShareStatus.timer = window.setTimeout(() => {
    shareStatus.textContent = "";
  }, 2600);
}

function showShareFallback(text, message) {
  if (!shareFallback) return;
  const textarea = shareFallback.querySelector("textarea");
  shareFallback.hidden = false;
  if (textarea) {
    textarea.value = text;
    textarea.focus();
    textarea.select();
  }
  setShareStatus(message);
}

async function writeShareText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Continue to the textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  textarea.remove();
  return copied;
}

function isLocalUrl() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

document.querySelectorAll("[data-share-popup]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();

    if (isLocalUrl()) {
      const copied = await writeShareText(link.dataset.shareText || window.location.href);
      const message = copied ? "লোকাল লিংক কপি হয়েছে, পোস্টে পেস্ট করুন" : "Facebook/শেয়ার পপআপে এই লেখা পেস্ট করুন";
      showShareFallback(link.dataset.shareText || window.location.href, message);
    }

    const width = 680;
    const height = 620;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    const popup = window.open(
      link.href,
      `share-${link.dataset.sharePlatform || "news"}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (popup) popup.focus();
    else window.location.href = link.href;
  });
});

document.querySelectorAll("[data-copy-url]").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.dataset.copyText || button.dataset.copyUrl;
    const copied = await writeShareText(text);
    button.textContent = copied ? "কপি হয়েছে" : "লিংক কপি করুন";
    button.classList.add("copied");
    if (copied) setShareStatus("শেয়ার লিংক কপি হয়েছে");
    else showShareFallback(text, "লিংক নির্বাচন করে কপি করুন");
    setTimeout(() => {
      button.textContent = "লিংক কপি";
      button.classList.remove("copied");
    }, 1800);
  });
});
