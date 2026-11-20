#!/usr/bin/env python3
"""Add a ready-to-share post to ready/feed.json (newest first, keeps 40).

usage: python3 tools/ready_add.py --image posts/x.jpg --caption cap.txt \
          --category health --title "শীতে হাঁপানি" [--time "2026-11-20 09:35"]
The image is copied to ready/img/. Test entries (id starting "test") are dropped.
"""
import argparse, json, os, shutil, subprocess
ap = argparse.ArgumentParser()
ap.add_argument('--image', required=True); ap.add_argument('--caption', required=True)
ap.add_argument('--category', required=True); ap.add_argument('--title', required=True)
ap.add_argument('--time')
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
feed_p = os.path.join(root, 'ready', 'feed.json')
t = a.time or subprocess.check_output(['date', '+%Y-%m-%d %H:%M'], env={**os.environ, 'TZ': 'Asia/Dhaka'}).decode().strip()
pid = t.replace('-', '').replace(' ', '-').replace(':', '')
ext = os.path.splitext(a.image)[1] or '.jpg'
dst = os.path.join(root, 'ready', 'img', pid + ext)
shutil.copyfile(a.image, dst)
cap = open(a.caption, encoding='utf-8').read().strip()
if len(cap) < 80: raise SystemExit('caption looks too short — refusing')
feed = json.load(open(feed_p, encoding='utf-8')) if os.path.exists(feed_p) else []
feed = [x for x in feed if not x['id'].startswith('test') and x['id'] != pid]
feed.insert(0, {'id': pid, 'time': t, 'category': a.category, 'title': a.title,
                'image': 'img/' + pid + ext, 'caption': cap})
for old in feed[40:]:
    p = os.path.join(root, 'ready', old['image'])
    if os.path.exists(p): os.remove(p)
json.dump(feed[:40], open(feed_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('added', pid, '->', dst)
