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
import re
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
ASSET_VERSION = "20260921a"  # ex: "20260901" — vide = pas de paramètre de version

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


def _fetch_section_visibility(query: str, warning_label: str) -> set[str] | None:
    """Renvoie les slugs *publiés* pour une requête l5d2lm_sections donnée,
    ou None (rien à masquer) si la requête échoue OU si elle ne renvoie
    STRICTEMENT AUCUNE ligne au total (statut confondu) : dans ce cas la
    migration correspondante n'a probablement pas encore été appliquée,
    et un ensemble vide serait interprété à tort comme « tout masquer ».
    Seule une réponse non vide, où certaines lignes existent mais aucune
    n'est publiée, produit un set() qui masque effectivement tout."""
    url = f"{SUPABASE_URL}/rest/v1/l5d2lm_sections?{query}&select=slug,status"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {SUPABASE_PUBLISHABLE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"Avertissement : {warning_label} non récupérées ({exc}) — laissées visibles.")
        return None
    if not rows:
        return None
    return {row["slug"] for row in rows if row.get("status") == "published"}


def fetch_published_section_slugs() -> set[str] | None:
    """Slugs des catégories de premier niveau publiées (parent_id is
    null). Voir _fetch_section_visibility pour la gestion prudente du
    cas « table pas encore peuplée »."""
    return _fetch_section_visibility("parent_id=is.null", "catégories publiées")


def fetch_published_activity_slugs() -> set[str] | None:
    """Slugs des activités (kind='proposal') publiées. Voir
    _fetch_section_visibility pour la gestion prudente du cas « table
    pas encore peuplée » (migration pas encore appliquée)."""
    return _fetch_section_visibility("kind=eq.proposal", "activités publiées")


def _slot_image_src(media: dict) -> str:
    return f'{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_PUBLIC_MEDIA_BUCKET}/{media["public_path"]}'


def render_proposition_slot(slot: dict, media: dict | None) -> str:
    band = f'<span class="flip-card__band-number" aria-hidden="true">{slot["band_number"]}</span>'
    if media:
        src = _slot_image_src(media)
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


def render_postcard_slot(slot: dict, media: dict | None) -> str:
    if media:
        src = html.escape(_slot_image_src(media), quote=True)
        alt = html.escape(media.get("alt_text") or "", quote=True)
        return f'<div class="postcard"><img src="{src}" alt="{alt}"></div>'
    fallback = slot.get("fallback")
    if fallback:
        return f'<div class="postcard"><img src="{fallback["src"]}" alt=""></div>'
    # Pas encore de photo, pas de fallback : mieux vaut ne rien casser
    # visuellement dans la bande de cartes postales qu'afficher une image
    # cassée — le prochain emplacement vide utilisera plutôt un fallback.
    return '<div class="postcard postcard--empty"></div>'


def render_slot(slot: dict, media: dict | None) -> str:
    if slot.get("kind") == "postcard":
        return render_postcard_slot(slot, media)
    return render_proposition_slot(slot, media)


def substitute_media_slots(content: str, page_slug: str, published: dict) -> str:
    for slot in SLOTS:
        if slot["page"] != page_slug:
            continue
        marker = f'<!-- MEDIA_SLOT:{slot["slot_key"]} -->'
        if marker not in content:
            continue
        content = content.replace(marker, render_slot(slot, published.get(slot["slot_key"])))
    return content


NAV_ITEM_RE = re.compile(
    r"<!-- NAV_ITEM:([\w-]+) -->.*?<!-- /NAV_ITEM -->\n?", re.DOTALL
)


def substitute_nav_visibility(chrome_html: str, published_section_slugs: set[str] | None) -> str:
    """Retire du menu les entrées dont la catégorie correspondante n'est
    pas publiée. published_section_slugs=None (erreur réseau) => rien
    n'est retiré, par prudence."""
    if published_section_slugs is None:
        return chrome_html
    def repl(match: re.Match) -> str:
        slug = match.group(1)
        return match.group(0) if slug in published_section_slugs else ""
    return NAV_ITEM_RE.sub(repl, chrome_html)


ACTIVITY_RE_TEMPLATE = r"<!-- ACTIVITY:{slug}:start -->.*?<!-- ACTIVITY:{slug}:end -->\n?"


def substitute_activity_blocks(content: str, published_activity_slugs: set[str] | None) -> str:
    """Retire les blocs d'activité (flip-cards) dont le slug n'est pas
    publié. published_activity_slugs=None (erreur réseau) => rien n'est
    retiré, par prudence."""
    if published_activity_slugs is None:
        return content
    for match in re.finditer(r"<!-- ACTIVITY:([\w-]+):start -->", content):
        slug = match.group(1)
        if slug in published_activity_slugs:
            continue
        pattern = re.compile(ACTIVITY_RE_TEMPLATE.format(slug=re.escape(slug)), re.DOTALL)
        content = pattern.sub("", content)
    return content


def render_head(page: dict, published_section_slugs: set[str] | None) -> str:
    tmpl = Template((ROOT / "_partials/head.html.tmpl").read_text(encoding="utf-8"))
    robots = page.get("robots")
    section_slug = page.get("section_slug")
    if (
        not robots
        and section_slug
        and published_section_slugs is not None
        and section_slug not in published_section_slugs
    ):
        # Catégorie masquée depuis /gestion : la page reste accessible par
        # URL directe (pas de suppression) mais n'est plus indexée.
        robots = "noindex, nofollow"
    robots_line = f'\n  <meta name="robots" content="{robots}">' if robots else ""
    asset_qs = f"?v={ASSET_VERSION}" if ASSET_VERSION else ""
    return tmpl.substitute(
        TITLE=page["title"],
        DESCRIPTION=page["description"],
        CANONICAL=f'{BASE_URL}/{page["slug"]}.html',
        ROBOTS_LINE=robots_line,
        ASSET_QS=asset_qs,
    )


def build_page(
    page: dict,
    published_slots: dict,
    chrome: str,
    published_activity_slugs: set[str] | None,
    published_section_slugs: set[str] | None,
) -> None:
    head = render_head(page, published_section_slugs)
    footer = (ROOT / "_partials/footer.html").read_text(encoding="utf-8")
    content = (ROOT / f'content/{page["slug"]}.html').read_text(encoding="utf-8")
    content = substitute_media_slots(content, page["slug"], published_slots)
    content = substitute_activity_blocks(content, published_activity_slugs)
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


def build_sitemap(published_section_slugs: set[str] | None) -> None:
    def is_indexable(p: dict) -> bool:
        if p.get("robots"):
            return False
        section_slug = p.get("section_slug")
        if section_slug and published_section_slugs is not None:
            return section_slug in published_section_slugs
        return True

    urls = "\n".join(
        f"  <url>\n    <loc>{BASE_URL}/{p['slug']}.html</loc>\n  </url>"
        for p in PAGES
        if is_indexable(p)
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
    published_section_slugs = fetch_published_section_slugs()
    published_activity_slugs = fetch_published_activity_slugs()
    chrome = (ROOT / "_partials/chrome.html").read_text(encoding="utf-8")
    chrome = substitute_nav_visibility(chrome, published_section_slugs)
    for page in PAGES:
        build_page(page, published_slots, chrome, published_activity_slugs, published_section_slugs)
    build_sitemap(published_section_slugs)
    print(f"{len(PAGES)} pages générées + sitemap.xml")


if __name__ == "__main__":
    main()
