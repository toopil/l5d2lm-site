#!/usr/bin/env python3
"""Génère les pages l5d2lm-*.html et sitemap.xml à partir de _partials/ + content/.

Usage : python3 build/build.py   (depuis la racine du dépôt)

Aucune dépendance externe (stdlib uniquement). Le script écrase les
fichiers l5d2lm-*.html et sitemap.xml à la racine du dépôt : ce sont
ces fichiers générés qui sont commités et déployés tels quels sur
GitHub Pages, pas de build côté serveur.
"""
import sys
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pages import PAGES, BASE_URL  # noqa: E402

# Bump ce numéro de version quand l5d2lm-style.css ou l5d2lm-script.js changent,
# pour casser le cache navigateur (même mécanisme que les logos, voir ?v=... dessus).
ASSET_VERSION = "20260831b"  # ex: "20260901" — vide = pas de paramètre de version


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


def build_page(page: dict) -> None:
    head = render_head(page)
    chrome = (ROOT / "_partials/chrome.html").read_text(encoding="utf-8")
    footer = (ROOT / "_partials/footer.html").read_text(encoding="utf-8")
    content = (ROOT / f'content/{page["slug"]}.html').read_text(encoding="utf-8")
    html = (
        "<!doctype html>\n"
        '<html lang="fr">\n'
        "<head>\n"
        f"{head}"
        "</head>\n"
        f"{chrome}"
        f"{content}"
        f"{footer}"
    )
    (ROOT / f'{page["slug"]}.html').write_text(html, encoding="utf-8")


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
    for page in PAGES:
        build_page(page)
    build_sitemap()
    print(f"{len(PAGES)} pages générées + sitemap.xml")


if __name__ == "__main__":
    main()
