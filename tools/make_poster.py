#!/usr/bin/env python3
"""Render a 1080x1080 Bangla poster JPEG for the Amar Natore FB page.
Usage: python3 tools/make_poster.py spec.json out.jpg
spec.json: {"tag": "...", "headline_1": "...", "headline_hl": "...", "headline_2": "...",
            "sub": "...", "chips": ["...", "..."], "theme": "blue|green|purple|orange"}
Needs: google-chrome (or chromium) and npm package @fontsource/noto-sans-bengali
installed under ./node_modules (run `npm i @fontsource/noto-sans-bengali@5` in the repo root first).
"""
import json, sys, os, subprocess, shutil, html, tempfile
from PIL import Image
spec = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(root, "node_modules/@fontsource/noto-sans-bengali/files")
themes = {"blue": ("#2b5cff", "#141a4a", "#0a0d24", "#ffb020"), "green": ("#16a34a", "#0b3d24", "#04170d", "#ffd23f"),
          "purple": ("#7c3aed", "#2a1259", "#0f0624", "#ffb020"), "orange": ("#f97316", "#5a2408", "#1f0b02", "#fde047")}
c1, c2, c3, acc = themes.get(spec.get("theme", "blue"), themes["blue"])
e = lambda k: html.escape(spec.get(k, ""))
chips = "".join(f"<div>{html.escape(c)}</div>" for c in spec.get("chips", [])[:4])
page = f"""<html><head><meta charset="utf-8"><style>
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-400-normal.woff2);font-weight:400}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-700-normal.woff2);font-weight:700}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-800-normal.woff2);font-weight:800}}
body{{margin:0;width:1080px;height:1080px;font-family:B,sans-serif;background:radial-gradient(circle at 75% 25%,{c1} 0%,{c2} 45%,{c3} 100%);color:#fff;position:relative;overflow:hidden}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:54px 54px}}
.tag{{position:absolute;top:70px;left:80px;background:{acc};color:{c2};font-weight:800;font-size:30px;padding:10px 26px;border-radius:40px}}
h1{{position:absolute;top:170px;left:80px;right:80px;margin:0;font-size:88px;line-height:1.3;font-weight:800}}
h1 span{{color:{acc}}}
p{{position:absolute;top:620px;left:80px;right:300px;font-size:38px;line-height:1.55;margin:0;color:#e6ebff}}
.chips{{position:absolute;bottom:150px;left:80px;right:80px;display:flex;gap:16px;flex-wrap:wrap}}
.chips div{{border:2px solid rgba(255,255,255,.45);border-radius:14px;padding:10px 22px;font-size:30px;font-weight:700;background:rgba(255,255,255,.12)}}
.bot{{position:absolute;right:70px;top:590px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,#ffffffcc,{c1} 60%,transparent 70%);box-shadow:0 0 120px {c1}}}
.eye{{position:absolute;top:85px;width:26px;height:26px;background:#fff;border-radius:50%}}
.foot{{position:absolute;bottom:55px;left:80px;font-size:32px;font-weight:800;color:{acc}}}
</style></head><body><div class="grid"></div><div class="tag">{e('tag')}</div>
<h1>{e('headline_1')}<br><span>{e('headline_hl')}</span> {e('headline_2')}</h1>
<p>{e('sub')}</p><div class="bot"><div class="eye" style="left:70px"></div><div class="eye" style="left:124px"></div></div>
<div class="chips">{chips}</div><div class="foot">আমার নাটোর</div></body></html>"""
d = tempfile.mkdtemp(); h = os.path.join(d, "p.html"); png = os.path.join(d, "p.png")
open(h, "w", encoding="utf-8").write(page)
chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
if not chrome: sys.exit("no chrome found")
subprocess.run([chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1080,1080",
                "--virtual-time-budget=3000", f"--screenshot={png}", f"file://{h}"], check=True, capture_output=True)
Image.open(png).convert("RGB").save(out, quality=90)
print(out)
