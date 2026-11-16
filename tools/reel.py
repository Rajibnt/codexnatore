#!/usr/bin/env python3
"""Amar Natore Reel maker — vertical 1080x1920 MP4 (Facebook Reels), ~15-30 s, with soft background music.

Usage:  python3 tools/reel.py reel.json out.mp4
Needs:  google-chrome/chromium, ffmpeg, and `npm i @fontsource/noto-sans-bengali@5` in the repo root.

reel.json:
  category : same keys as tools/poster.py (natore, health, ai, phone, islam, recipe, sports, jobs,
             scholarship, career, computer, english, branding) — sets colours
  tag      : short label for the intro pill
  title    : intro headline (<= 30 chars)
  highlight: intro highlight line (<= 22 chars)
  points   : 2-5 short points, one per slide (<= 70 chars each); a point may be
             {"text": "...", "big": "৳১৯,৯৯৯"} to show a big number above the text
  cta      : closing line (default: "আরও এমন পোস্ট পেতে পেজটি ফলো করুন")
  source   : optional source line on the closing slide, e.g. "সূত্র: প্রথম আলো"
  music    : true/false (default true) — generated soft pad, no copyrighted audio
  voice    : true/false (default true) — Bangla voice-over (offline neural TTS, sherpa-onnx + Coqui Bangla VITS)
  intro_vo : spoken text for the intro slide (default: title + highlight)
  outro_vo : spoken text for the closing slide (default: cta)
  points[i].vo : spoken text for a point (default: its text). Write VO in natural spoken Bangla,
             numbers as words (e.g. "উনিশ হাজার নয়শো নিরানব্বই টাকা"), no English abbreviations if avoidable.
Voice setup (once per machine): bash tools/setup_tts.sh   (downloads the model from GitHub releases to ~/.tts)
"""
import json, sys, os, subprocess, shutil, html, tempfile

W, H, FPS = 1080, 1920, 30
spec = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(root, "node_modules/@fontsource/noto-sans-bengali/files")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CAT = {
 "natore": ("নাটোর", "#0f3d3e", "#14746f", "#f4c95d"), "health": ("স্বাস্থ্য", "#0b3b2e", "#1f8a5b", "#ffd166"),
 "ai": ("AI", "#141a4a", "#2b5cff", "#ffb020"), "phone": ("মোবাইল", "#111827", "#0ea5e9", "#facc15"),
 "islam": ("ইসলাম", "#0b3d2c", "#14532d", "#d4af37"), "recipe": ("রান্না", "#5a1a0b", "#d9480f", "#ffd43b"),
 "sports": ("খেলা", "#0b2545", "#1d4ed8", "#a3e635"), "jobs": ("চাকরি", "#10213f", "#1e3a8a", "#f59e0b"),
 "scholarship": ("স্কলারশিপ", "#2e1065", "#6d28d9", "#fbbf24"), "career": ("ক্যারিয়ার", "#1f2937", "#e8590c", "#ffd8a8"),
 "computer": ("কম্পিউটার স্কিল", "#0c2d48", "#0284c7", "#67e8f9"), "english": ("English", "#4a0e1c", "#9f1239", "#fde68a"),
 "branding": ("পার্সোনাল ব্র্যান্ড", "#0a0a0a", "#3f3f46", "#eab308"),
}
lab, dk, md, ac = CAT.get(spec.get("category", "ai"), CAT["ai"])
BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
esc = lambda s: html.escape(str(s or ""))
chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
if not chrome: sys.exit("no chrome found")

CSS = f"""
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-400-normal.woff2);font-weight:400}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-700-normal.woff2);font-weight:700}}
@font-face{{font-family:B;src:url(file://{F}/noto-sans-bengali-bengali-800-normal.woff2);font-weight:800}}
*{{box-sizing:border-box}}
body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;font-family:B,'Noto Sans',sans-serif;color:#fff;
 background:radial-gradient(circle at 78% 14%,{md} 0%,{dk} 52%,#05070f 100%);position:relative}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:72px 72px}}
.ring{{position:absolute;right:-180px;top:-160px;width:640px;height:640px;border-radius:50%;border:48px solid {ac};opacity:.16}}
.ring2{{position:absolute;left:-220px;bottom:180px;width:520px;height:520px;border-radius:50%;background:{md};opacity:.25;filter:blur(40px)}}
.pill{{display:inline-block;background:{ac};color:{dk};font-weight:800;font-size:40px;padding:14px 38px;border-radius:60px}}
.brand{{position:absolute;left:90px;right:90px;bottom:120px;display:flex;align-items:center;justify-content:space-between;font-size:38px;font-weight:800}}
.brand .m{{display:flex;align-items:center;gap:18px}}
.brand .d{{width:62px;height:62px;border-radius:16px;background:{ac};color:{dk};display:flex;align-items:center;justify-content:center;font-size:32px}}
.brand .c{{font-size:34px;opacity:.85}}
.dots{{position:absolute;left:0;right:0;top:120px;display:flex;justify-content:center;gap:14px}}
.dots i{{width:46px;height:10px;border-radius:6px;background:rgba(255,255,255,.25)}}
.dots i.on{{background:{ac}}}
"""
BRAND = f'<div class="brand"><div class="m"><div class="d">আ</div>আমার নাটোর</div><div class="c">#{esc(lab)}</div></div>'

pts = []
for p in spec.get("points", [])[:5]:
    pts.append(p if isinstance(p, dict) else {"text": p})
n = len(pts)

def dots(k):
    return '<div class="dots">' + "".join(f'<i class="{"on" if i <= k else ""}"></i>' for i in range(n + 2)) + "</div>"

slides = []
slides.append(f"""<div class="grid"></div><div class="ring"></div><div class="ring2"></div>{dots(0)}
<div style="position:absolute;left:90px;right:90px;top:520px"><div class="pill">{esc(spec.get('tag'))}</div>
<div style="font-size:120px;font-weight:800;line-height:1.25;margin-top:60px">{esc(spec.get('title'))}</div>
<div style="font-size:110px;font-weight:800;line-height:1.25;color:{ac}">{esc(spec.get('highlight'))}</div>
<div style="width:160px;height:14px;border-radius:8px;background:{ac};margin-top:60px"></div></div>{BRAND}""")
for i, p in enumerate(pts, 1):
    _bl = len(str(p.get("big") or "")); _bs = 150 if _bl <= 10 else (112 if _bl <= 14 else 88)
    big = f'<div style="white-space:nowrap;font-size:{_bs}px;font-weight:800;color:{ac};line-height:1.15;margin-bottom:30px">{esc(p.get("big"))}</div>' if p.get("big") else ""
    slides.append(f"""<div class="grid"></div><div class="ring"></div>{dots(i)}
<div style="position:absolute;left:90px;right:90px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">
<div style="width:170px;height:170px;border-radius:50%;background:{ac};color:{dk};font-size:96px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:60px">{str(i).translate(BN)}</div>
{big}<div style="font-size:82px;font-weight:800;line-height:1.45">{esc(p.get('text'))}</div></div>{BRAND}""")
cta = spec.get("cta") or "আরও এমন পোস্ট পেতে পেজটি ফলো করুন"
src = f'<div style="font-size:40px;opacity:.8;margin-top:50px">{esc(spec.get("source"))}</div>' if spec.get("source") else ""
slides.append(f"""<div class="grid"></div><div class="ring2"></div>{dots(n + 1)}
<div style="position:absolute;left:90px;right:90px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
<div style="width:200px;height:200px;border-radius:52px;background:{ac};color:{dk};font-size:120px;font-weight:800;display:flex;align-items:center;justify-content:center">আ</div>
<div style="font-size:96px;font-weight:800;margin-top:60px">আমার নাটোর</div>
<div style="font-size:64px;font-weight:700;line-height:1.5;margin-top:40px;color:{ac}">{esc(cta)}</div>
<div style="font-size:48px;margin-top:40px">লাইক · কমেন্ট · শেয়ার</div>{src}</div>""")

tmp = tempfile.mkdtemp()
pngs = []
for k, body in enumerate(slides):
    hp = os.path.join(tmp, f"s{k}.html"); pp = os.path.join(tmp, f"s{k}.png")
    open(hp, "w", encoding="utf-8").write(f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>')
    subprocess.run([chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", f"--window-size={W},{H}",
                    "--virtual-time-budget=3000", f"--screenshot={pp}", f"file://{hp}"], check=True, capture_output=True)
    pngs.append(pp)

# durations: intro 3.5s, points by text length (3.5-5.5s), outro 3.5s
durs = [3.5] + [min(5.5, 3.2 + len(p.get("text", "")) / 30) for p in pts] + [3.5]
vo_files = []
if spec.get("voice", True):
    try:
        import sherpa_onnx, soundfile as sf
        md_dir = os.path.expanduser(os.environ.get("TTS_MODEL_DIR", "~/.tts/vits-coqui-bn-custom_female"))
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{md_dir}/model.onnx", tokens=f"{md_dir}/tokens.txt"), num_threads=4))
        tts = sherpa_onnx.OfflineTts(cfg)
        texts = [spec.get("intro_vo") or f"{spec.get('title','')} {spec.get('highlight','')}"]
        texts += [p.get("vo") or p.get("text", "") for p in pts]
        texts += [spec.get("outro_vo") or cta]
        for k, tx in enumerate(texts):
            a = tts.generate(tx, sid=0, speed=float(spec.get("voice_speed", 1.0)))
            fp = os.path.join(tmp, f"vo{k}.wav"); sf.write(fp, a.samples, a.sample_rate)
            dur = len(a.samples) / a.sample_rate
            vo_files.append((fp, dur))
            durs[k] = max(durs[k], dur + 1.1)
    except Exception as ex:
        print("voice-over skipped:", ex, file=sys.stderr); vo_files = []
X = 0.5  # crossfade
args, filt = ["ffmpeg", "-y", "-loglevel", "error"], []
for k, (pp, d) in enumerate(zip(pngs, durs)):
    args += ["-loop", "1", "-t", f"{d:.2f}", "-i", pp]
    fr = int(d * FPS)
    filt.append(f"[{k}:v]scale=1296:2304,zoompan=z='min(zoom+0.0005,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fr}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{k}]")
prev, t = "v0", durs[0]
for k in range(1, len(pngs)):
    off = t - X
    filt.append(f"[{prev}][v{k}]xfade=transition=slideleft:duration={X}:offset={off:.2f}[x{k}]")
    prev, t = f"x{k}", t + durs[k] - X
total = t
starts, acc = [], 0.0
for k, d in enumerate(durs):
    starts.append(acc); acc += d - X
amix_in = []
if spec.get("music", True):
    # generated soft pad (no copyrighted audio): two detuned chords with slow tremolo
    expr = ("0.05*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t))*(0.6+0.4*sin(2*PI*0.25*t))"
            "+0.03*sin(2*PI*110*t)")
    args += ["-f", "lavfi", "-t", f"{total:.2f}", "-i", f"aevalsrc='{expr}':s=44100:c=stereo"]
    a = len(pngs)
    mv = 0.25 if vo_files else 0.8
    filt.append(f"[{a}:a]lowpass=f=1800,afade=t=in:d=1.5,afade=t=out:st={total-2:.2f}:d=2,volume={mv}[mus]")
    amix_in.append("[mus]")
base = len(pngs) + (1 if spec.get("music", True) else 0)
for k, (fp, dur) in enumerate(vo_files):
    args += ["-i", fp]
    ms = int((starts[k] + 0.35) * 1000)
    filt.append(f"[{base + k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=1.25[vo{k}]")
    amix_in.append(f"[vo{k}]")
if amix_in:
    filt.append("".join(amix_in) + f"amix=inputs={len(amix_in)}:normalize=0:duration=longest,atrim=0:{total:.2f},alimiter=limit=0.9[a]")
    maps = ["-map", f"[{prev}]", "-map", "[a]", "-c:a", "aac", "-b:a", "160k"]
else:
    maps = ["-map", f"[{prev}]"]
args += ["-filter_complex", ";".join(filt)] + maps + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
         "-pix_fmt", "yuv420p", "-r", str(FPS), "-movflags", "+faststart", "-t", f"{total:.2f}", out]
subprocess.run(args, check=True)
print(out, f"{total:.1f}s")
