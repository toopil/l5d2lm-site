#!/usr/bin/env python3
"""Génère les pages l5d2lm-*.html et sitemap.xml à partir de _partials/ + content/.

Usage : python3 build/build.py   (depuis la racine du dépôt)

Aucune dépendance externe (stdlib uniquement). Le script écrase les
fichiers l5d2lm-*.html et sitemap.xml à la racine du dépôt : ce sont
ces fichiers générés qui sont commités et déployés tels quels sur
GitHub Pages, pas de build côté serveur.
"""
from __future__ import annotations

import html
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pages import PAGES, BASE_URL  # noqa: E402
from slots import SLOTS  # noqa: E402

# Bump ce numéro de version quand l5d2lm-style.css ou l5d2lm-script.js changent,
# pour casser le cache navigateur (même mécanisme que les logos, voir ?v=... dessus).
ASSET_VERSION = "20260919b"  # ex: "20260901" — vide = pas de paramètre de version

# Lecture publique uniquement (RLS dédiée aux médias publiés) : la même clé
# publishable déjà utilisée côté client, sans danger à committer/exposer en CI.
SUPABASE_URL = "https://gopiicysitdcmxebdiwb.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dvhEnUhtPMPQ6-znTWXgmg_upJNaeEf"
SUPABASE_PUBLIC_MEDIA_BUCKET = "l5d2lm-public-media"


def fetch_published_slots() -> dict:
    """{slot_key: {public_path, alt_text}} pour les emplacements publiés
    depuis /gestion. En cas d'erreur réseau/API, renvoie {} : les fragments
    gardent alors leur repère "Photo à venir" plutôt que d'échouer le build."""
    if not SLOTS:
        return {}
    slot_keys = ",".join(slot["slot_key"] for slot in SLOTS)
    url = (
        f"{SUPABASE_URL}/rest/v1/l5d2lm_media_usages"
        f"?slot_key=in.({slot_keys})&active=eq.true"
        f"&select=slot_key,media:l5d2lm_media(public_path,alt_text)"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {SUPABASE_PUBLISHABLE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"Avertissement : emplacements publiés non récupérés ({exc}) — 'Photo à venir' conservé.")
        return {}

    published = {}
    for row in rows:
        media = row.get("media")
        if media and media.get("public_path"):
            published[row["slot_key"]] = media
    return published


def render_slot(slot: dict, media: dict | None) -> str:
    band = f'<span class="flip-card__band-number" aria-hidden="true">{slot["band_number"]}</span>'
    if media:
        src = f'{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_PUBLIC_MEDIA_BUCKET}/{media["public_path"]}'
        alt = html.escape(media.get("alt_text") or "", quote=True)
        return (
            '<div class="flip-card__media">\n'
            f'                  {band}\n'
            f'                  <img src="{html.escape(src, quote=True)}" alt="{alt}" loading="lazy">\n'
            '                </div>'
        )
    fallback = slot.get("fallback")
    if fallback:
        # Photo déjà en place avant le passage par ce mécanisme (ex. import
        # initial du site) : reste affichée tant que l'admin ne publie pas
        # explicitement un remplacement — jamais de régression silencieuse
        # vers "Photo à venir" pour une photo qui existe déjà.
        dims = f' width="{fallback["width"]}" height="{fallback["height"]}"' if fallback.get("width") else ""
        return (
            '<div class="flip-card__media">\n'
            f'                  {band}\n'
            f'                  <img src="{fallback["src"]}" alt=""{dims}>\n'
            '                </div>'
        )
    title = html.escape(slot["title"])
    return (
        '<div class="flip-card__media flip-card__media--placeholder">\n'
        f'                  {band}\n'
        '                  <p class="flip-card__media-placeholder-label" aria-hidden="true">\n'
        f'                    <strong>{title}</strong>\n'
        '                    <span>Photo à venir</span>\n'
        '                  </p>\n'
        '                </div>'
    )


def substitute_media_slots(content: str, page_slug: str, published: dict) -> str:
    for slot in SLOTS:
        if slot["page"] != page_slug:
            continue
        marker = f'<!-- MEDIA_SLOT:{slot["slot_key"]} -->'
        if marker not in content:
            continue
        content = content.replace(marker, render_slot(slot, published.get(slot["slot_key"])))
    return content


def render_head(page: dict) -> str:
    tmpl = Template((ROOT / "_partials/head.html.tmpl").read_text(encoding="utf-8"))
    robots = page.get("robots")
    robots_line = f'\n  <meta name="robots" content="{robots}">' if robots else ""
    asset_qs = f"?v={ASSET_VERSION}" if ASSET_VERSION else ""
    return tmpl.substitute(
        TITLE=page["title"],
        DESCRIPTION=page["description"],
        CANONICAL=f'{BASE_URL}/{page["slug"]}.html',
        ROBOTS_LINE=robots_line,
        ASSET_QS=asset_qs,
    )


def build_page(page: dict, published_slots: dict) -> None:
    head = render_head(page)
    chrome = (ROOT / "_partials/chrome.html").read_text(encoding="utf-8")
    footer = (ROOT / "_partials/footer.html").read_text(encoding="utf-8")
    content = (ROOT / f'content/{page["slug"]}.html').read_text(encoding="utf-8")
    content = substitute_media_slots(content, page["slug"], published_slots)
    page_html = (
        "<!doctype html>\n"
        '<html lang="fr">\n'
        "<head>\n"
        f"{head}"
        "</head>\n"
        f"{chrome}"
        f"{content}"
        f"{footer}"
    )
    (ROOT / f'{page["slug"]}.html').write_text(page_html, encoding="utf-8")


def build_sitemap() -> None:
    urls = "\n".join(
        f"  <url>\n    <loc>{BASE_URL}/{p['slug']}.html</loc>\n  </url>"
        for p in PAGES
        if not p.get("robots")
    )
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")


def main() -> None:
    published_slots = fetch_published_slots()
    for page in PAGES:
        build_page(page, published_slots)
    build_sitemap()
    print(f"{len(PAGES)} pages générées + sitemap.xml")


if __name__ == "__main__":
    main()
