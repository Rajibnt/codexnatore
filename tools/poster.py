#!/usr/bin/env python3
"""Amar Natore poster renderer — multi-layout, multi-category (1080x1350, 4:5 Facebook feed size).

Usage:  python3 tools/poster.py spec.json out.jpg
Needs:  google-chrome/chromium on PATH, and `npm i @fontsource/noto-sans-bengali@5` run in the repo root.

spec.json keys (all text in Bangla unless a name/brand):
  layout    : spotlight | list | quote | news | stat | split     (pick by content, vary between posts)
  category  : natore | health | ai | phone | islam | recipe | sports | jobs | scholarship |
              career | computer | english | branding
  tag       : short label shown in the pill (<= 18 chars), e.g. "আজকের AI খবর"
  title     : main headline (<= 40 chars ideal)
  highlight : optional words shown in accent colour after/under the title (<= 20 chars)
  sub       : optional one-line sub text (<= 60 chars)
  items     : list of 3-5 short points (list layout; <= 38 chars each)
  quote     : quote text (quote layout; <= 140 chars)
  ref       : reference line under quote, e.g. "সহিহ বুখারি, হাদিস ৬০১৮"
  big       : big value for stat/split layout, e.g. "৳২৪,৯৯৯" or "৩০ নভেম্বর"
  big_label : label under big value, e.g. "অফিসিয়াল দাম" / "আবেদনের শেষ তারিখ"
  specs     : list of [label, value] rows (stat layout; up to 5)
  date      : date text for news layout, e.g. "১৭ নভেম্বর ২০২৬"
  source    : source line, e.g. "সূত্র: প্রথম আলো"
  (spotlight layout accepts items = up to 4 short tips (<= 26 chars) shown as cards; news layout also accepts items = 2-4 key facts, shown in a fact box; split layout accepts items as bullets)
"""
import json, sys, os, subprocess, shutil, html, tempfile
from PIL import Image

W, H = 1080, 1350
spec = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(root, "node_modules/@fontsource/noto-sans-bengali/files")

# category: (label, dark, mid, accent, light-bg, icon-glyph)
CAT = {
 "natore":      ("নাটোর",        "#0f3d3e", "#14746f", "#f4c95d", "#eef7f6", "ন"),
 "health":      ("স্বাস্থ্য",      "#0b3b2e", "#1f8a5b", "#ffd166", "#eef8f2", "+"),
 "ai":          ("AI",           "#141a4a", "#2b5cff", "#ffb020", "#eef1ff", "AI"),
 "phone":       ("মোবাইল",       "#111827", "#0ea5e9", "#facc15", "#eef6fb", "▣"),
 "islam":       ("ইসলাম",        "#0b3d2c", "#14532d", "#d4af37", "#f6f3e8", "☾"),
 "recipe":      ("রান্না",         "#5a1a0b", "#d9480f", "#ffd43b", "#fff4e6", "◍"),
 "sports":      ("খেলা",          "#0b2545", "#1d4ed8", "#a3e635", "#eef4ff", "●"),
 "jobs":        ("চাকরি",         "#10213f", "#1e3a8a", "#f59e0b", "#f3f6fc", "✓"),
 "scholarship": ("স্কলারশিপ",      "#2e1065", "#6d28d9", "#fbbf24", "#f5f0ff", "★"),
 "career":      ("ক্যারিয়ার",       "#1f2937", "#e8590c", "#ffd8a8", "#fbf6f1", "↗"),
 "computer":    ("কম্পিউটার স্কিল", "#0c2d48", "#0284c7", "#67e8f9", "#eef7fc", "⌘"),
 "english":     ("English",      "#4a0e1c", "#9f1239", "#fde68a", "#fdf4f0", "Aa"),
 "branding":    ("পার্সোনাল ব্র্যান্ড", "#0a0a0a", "#3f3f46", "#eab308", "#f6f5f0", "◆"),
}
lab, dk, md, ac, lt, icon = CAT.get(spec.get("category", "ai"), CAT["ai"])
e = lambda k: html.escape(str(spec.get(k, "") or ""))
layout = spec.get("layout", "spotlight")

base_css = f"""
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-400-normal.woff2);font-weight:400}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-700-normal.woff2);font-weight:700}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-800-normal.woff2);font-weight:800}}
*{{box-sizing:border-box}}
body{{margin:0;width:{W}px;height:{H}px;font-family:B,'Noto Sans',sans-serif;position:relative;overflow:hidden}}
.pill{{display:inline-block;background:{ac};color:{dk};font-weight:800;font-size:30px;padding:10px 28px;border-radius:40px}}
.brand{{position:absolute;left:72px;right:72px;bottom:52px;display:flex;align-items:center;justify-content:space-between;font-size:30px;font-weight:800}}
.brand .mark{{display:flex;align-items:center;gap:14px}}
.brand .dot{{width:44px;height:44px;border-radius:12px;background:{ac};color:{dk};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}}
.brand .cat{{font-size:26px;font-weight:700;opacity:.85}}
"""

def brand(color="#fff"):
    return f'<div class="brand" style="color:{color}"><div class="mark"><div class="dot">আ</div>আমার নাটোর</div><div class="cat">#{html.escape(lab)}</div></div>'

if layout == "spotlight":
    BN = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')
    tips = "".join(f'<div class="t"><b>{str(i+1).translate(BN)}</b><span>{html.escape(x)}</span></div>' for i, x in enumerate(spec.get("items", [])[:4]))
    body = f"""<style>{base_css}
body{{background:radial-gradient(circle at 80% 18%,{md} 0%,{dk} 55%,#05070f 100%);color:#fff}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:60px 60px}}
.ring{{position:absolute;right:-120px;top:-120px;width:520px;height:520px;border-radius:50%;border:40px solid {ac};opacity:.18}}
.wrap{{position:absolute;left:72px;right:72px;top:90px}}
h1{{font-size:96px;line-height:1.28;font-weight:800;margin:46px 0 0}}
h1 span{{color:{ac};display:block}}
p{{font-size:40px;line-height:1.55;color:#e8ecff;margin:48px 0 0;max-width:860px}}
.bar{{width:120px;height:10px;background:{ac};border-radius:6px;margin-top:48px}}
.tips{{position:absolute;left:72px;right:72px;bottom:150px;display:grid;grid-template-columns:1fr 1fr;gap:18px}}
.t{{background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.18);border-radius:22px;padding:20px 22px;display:flex;gap:16px;align-items:center;font-size:30px;font-weight:700;line-height:1.35}}
.t b{{flex:none;width:52px;height:52px;border-radius:50%;background:{ac};color:{dk};display:flex;align-items:center;justify-content:center;font-size:28px}}
</style><div class="grid"></div><div class="ring"></div>
<div class="wrap"><div class="pill">{e('tag')}</div><h1>{e('title')}<span>{e('highlight')}</span></h1><div class="bar"></div><p>{e('sub')}</p></div>{('<div class="tips">' + tips + '</div>') if tips else ''}{brand()}"""

elif layout == "list":
    BN = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')
    def _li(t):
        if '|' in t:
            a, b = [x.strip() for x in t.split('|', 1)]
            return f'<span>{html.escape(a)}<small>{html.escape(b)}</small></span>'
        return f'<span>{html.escape(t)}</span>'
    items = "".join(f'<li><b>{str(i+1).translate(BN)}</b>{_li(t)}</li>' for i, t in enumerate(spec.get("items", [])[:5]))
    body = f"""<style>{base_css}
body{{background:{lt};color:{dk}}}
.head{{background:linear-gradient(135deg,{dk},{md});color:#fff;padding:80px 72px 70px;border-bottom-right-radius:120px}}
h1{{font-size:76px;line-height:1.3;font-weight:800;margin:36px 0 0}}
h1 span{{color:{ac}}}
ul{{list-style:none;margin:56px 72px 0;padding:0}}
li{{display:flex;align-items:center;gap:28px;background:#fff;border-radius:24px;padding:22px 30px;margin-bottom:20px;box-shadow:0 6px 0 rgba(0,0,0,.06);font-size:38px;font-weight:700;line-height:1.4}}
li small{{display:block;font-size:30px;font-weight:600;color:{md};margin-top:4px}}
li b{{flex:none;width:72px;height:72px;border-radius:50%;background:{md};color:#fff;display:flex;align-items:center;justify-content:center;font-size:36px}}
.sub{{position:absolute;left:72px;right:72px;bottom:118px;font-size:32px;color:{md};font-weight:700}}
</style><div class="head"><div class="pill">{e('tag')}</div><h1>{e('title')} <span>{e('highlight')}</span></h1></div>
<ul>{items}</ul><div class="sub">{e('sub')}</div>{brand(dk)}"""

elif layout == "quote":
    body = f"""<style>{base_css}
body{{background:linear-gradient(160deg,{dk} 0%,{md} 100%);color:#fff}}
.frame{{position:absolute;inset:48px;border:3px solid {ac};border-radius:36px;opacity:.55}}
.wrap{{position:absolute;left:110px;right:110px;top:150px;text-align:center}}
.q{{font-size:220px;line-height:.6;color:{ac};font-family:Georgia,serif;height:120px}}
blockquote{{margin:30px 0 0;font-size:56px;line-height:1.6;font-weight:700}}
.ref{{margin-top:50px;font-size:34px;color:{ac};font-weight:700}}
.orn{{width:180px;height:4px;background:{ac};margin:46px auto 0;border-radius:4px}}
.top{{position:absolute;top:100px;left:0;right:0;text-align:center}}
.brand{{left:96px;right:96px;bottom:86px}}
</style><div class="frame"></div><div class="top"><div class="pill">{e('tag')}</div></div>
<div class="wrap" style="top:330px"><div class="q">“</div><blockquote>{e('quote')}</blockquote><div class="orn"></div><div class="ref">{e('ref')}</div></div>{brand()}"""

elif layout == "news":
    facts = "".join(f'<div class="f"><i></i><span>{html.escape(t)}</span></div>' for t in spec.get("items", [])[:4])
    body = f"""<style>{base_css}
body{{background:#fff;color:#111}}
.band{{background:{dk};color:#fff;padding:56px 72px;display:flex;justify-content:space-between;align-items:center}}
.date{{font-size:30px;font-weight:700;opacity:.9}}
.stripe{{height:14px;background:{ac}}}
.wrap{{padding:70px 72px 0}}
h1{{font-size:84px;line-height:1.3;font-weight:800;margin:0;color:{dk}}}
h1 span{{color:{md}}}
p{{font-size:40px;line-height:1.6;color:#374151;margin:44px 0 0;border-left:10px solid {ac};padding-left:28px}}
.src{{position:absolute;left:72px;bottom:140px;font-size:28px;color:#6b7280;font-weight:700}}
.blk{{position:absolute;right:-80px;bottom:200px;width:360px;height:360px;border-radius:50%;background:{lt}}}
.facts{{margin:46px 72px 0;background:{lt};border-radius:28px;padding:18px 34px;position:relative}}
.f{{display:flex;gap:22px;align-items:flex-start;font-size:34px;font-weight:700;line-height:1.45;padding:16px 0;color:{dk}}}
.f+.f{{border-top:2px solid rgba(0,0,0,.07)}}
.f i{{flex:none;width:18px;height:18px;border-radius:50%;background:{md};margin-top:17px}}
</style><div class="band"><div class="pill">{e('tag')}</div><div class="date">{e('date')}</div></div><div class="stripe"></div>
<div class="blk"></div><div class="wrap"><h1>{e('title')} <span>{e('highlight')}</span></h1><p>{e('sub')}</p></div>{('<div class="facts">' + facts + '</div>') if facts else ''}
<div class="src">{e('source')}</div>{brand(dk)}"""

elif layout == "stat":
    rows = "".join(f'<tr><td>{html.escape(str(k))}</td><td>{html.escape(str(v))}</td></tr>' for k, v in spec.get("specs", [])[:5])
    body = f"""<style>{base_css}
body{{background:{lt};color:{dk}}}
.top{{padding:80px 72px 0}}
h1{{font-size:68px;line-height:1.3;font-weight:800;margin:34px 0 0}}
.card{{margin:44px 72px 0;background:linear-gradient(135deg,{dk},{md});color:#fff;border-radius:36px;padding:48px 56px}}
.big{{font-size:112px;font-weight:800;color:{ac};line-height:1.15}}
.bl{{font-size:34px;font-weight:700;opacity:.9;margin-top:6px}}
table{{margin:36px 72px 0;width:calc(100% - 144px);border-collapse:separate;border-spacing:0 14px;font-size:34px}}
td{{background:#fff;padding:20px 28px;font-weight:700}}
td:first-child{{border-radius:18px 0 0 18px;color:{md};width:68%}}
td:last-child{{border-radius:0 18px 18px 0;text-align:right;font-size:40px;font-weight:800}}
h1 em{{font-style:normal;color:{md}}}
.src{{position:absolute;left:72px;bottom:150px;font-size:26px;font-weight:600;opacity:.7}}
</style><div class="top"><div class="pill">{e('tag')}</div><h1>{e('title')}{(' <em>' + e('highlight') + '</em>') if spec.get('highlight') else ''}</h1></div>
<div class="card"><div class="big">{e('big')}</div><div class="bl">{e('big_label')}</div></div><table>{rows}</table>{('<div class="src">' + e('source') + '</div>') if spec.get('source') else ''}{brand(dk)}"""

else:  # split
    _b = str(spec.get('big', '') or icon)
    bigsz = 150 if len(_b) <= 5 else (104 if len(_b) <= 8 else 84)
    sitems = ''.join(f'<li>{html.escape(t)}</li>' for t in spec.get('items', [])[:4])
    body = f"""<style>{base_css}
body{{background:{lt};color:{dk}}}
.left{{position:absolute;left:0;top:0;bottom:0;width:430px;background:linear-gradient(180deg,{md},{dk});color:#fff;padding:90px 50px;display:flex;flex-direction:column;justify-content:center}}
.big{{font-size:{bigsz}px;font-weight:800;line-height:1.15;color:{ac}}}
.bl{{font-size:36px;font-weight:700;margin-top:24px;line-height:1.4}}
.right{{position:absolute;left:490px;right:64px;top:110px}}
h1{{font-size:72px;line-height:1.3;font-weight:800;margin:40px 0 0}}
h1 span{{color:{md};display:block}}
p{{font-size:38px;line-height:1.6;margin:40px 0 0;color:#374151}}
ul{{margin:36px 0 0;padding:0;list-style:none}}
ul li{{font-size:32px;font-weight:700;line-height:1.45;padding:16px 0 16px 46px;position:relative;border-top:2px solid rgba(0,0,0,.07)}}
ul li:before{{content:'';position:absolute;left:4px;top:30px;width:20px;height:20px;border-radius:6px;background:{ac}}}
.brand{{left:490px}}
</style><div class="left"><div class="big">{e('big') or html.escape(icon)}</div><div class="bl">{e('big_label')}</div></div>
<div class="right"><div class="pill">{e('tag')}</div><h1>{e('title')}<span>{e('highlight')}</span></h1><p>{e('sub')}</p><ul>{sitems}</ul></div>{brand(dk)}"""

page = f'<html><head><meta charset="utf-8"></head><body>{body}</body></html>'
d = tempfile.mkdtemp(); h = os.path.join(d, "p.html"); png = os.path.join(d, "p.png")
open(h, "w", encoding="utf-8").write(page)
chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
if not chrome: sys.exit("no chrome found")
subprocess.run([chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", f"--window-size={W},{H}",
                "--virtual-time-budget=3000", f"--screenshot={png}", f"file://{h}"], check=True, capture_output=True)
Image.open(png).convert("RGB").save(out, quality=90)
print(out)
