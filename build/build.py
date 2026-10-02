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
from slots import SLOTS, POSTCARD_CATEGORY_SECTION_SLUGS  # noqa: E402
from texts import TEXT_BLOCKS, render_lead, render_body, is_safe_url  # noqa: E402

TEXT_SNAPSHOT_PATH = ROOT / "build" / "published-texts.snapshot.json"

# Bump ce numéro de version quand l5d2lm-style.css ou l5d2lm-script.js changent,
# pour casser le cache navigateur (même mécanisme que les logos, voir ?v=... dessus).
ASSET_VERSION = "20261002f"  # ex: "20260901" — vide = pas de paramètre de version

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


def fetch_published_text_blocks() -> dict | None:
    """{(page_slug, block_key): {title, eyebrow, lead, body, button_label,
    button_url}} pour les textes publiés depuis /gestion > Site > Textes.
    La RLS limite déjà la clé publishable aux lignes status='published' et
    deleted_at is null (voir migration de fondation) : inutile de
    refiltrer ici.

    None UNIQUEMENT si la requête échoue (réseau/parsing) — c'est le
    signal utilisé par resolve_text_blocks() pour retomber sur le dernier
    instantané committé plutôt que de perdre une publication récente. Un
    dict vide (requête réussie, rien publié) est en revanche un résultat
    sûr en lui-même : contrairement aux catégories, l'absence de texte
    publié pour un bloc ne doit jamais « tout masquer » — elle laisse
    simplement le texte d'origine du fragment affiché, comme aujourd'hui."""
    url = (
        f"{SUPABASE_URL}/rest/v1/l5d2lm_text_blocks"
        f"?select=page_slug,block_key,title,eyebrow,lead,body,button_label,button_url"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {SUPABASE_PUBLISHABLE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"Avertissement : textes publiés non récupérés ({exc}) — repli sur le dernier instantané connu.")
        return None
    return {(row["page_slug"], row["block_key"]): row for row in rows}


def load_text_snapshot() -> dict:
    """Dernier instantané de textes publiés committé dans le dépôt — filet
    de sécurité si Supabase est injoignable pendant un build (voir
    resolve_text_blocks). {} si le fichier n'existe pas encore (avant la
    toute première publication) ou est illisible."""
    if not TEXT_SNAPSHOT_PATH.exists():
        return {}
    try:
        rows = json.loads(TEXT_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except ValueError:
        return {}
    return {(row["page_slug"], row["block_key"]): row for row in rows}


def save_text_snapshot(published: dict) -> None:
    rows = [
        {"page_slug": page_slug, "block_key": block_key, **{
            k: v for k, v in row.items() if k not in ("page_slug", "block_key")
        }}
        for (page_slug, block_key), row in sorted(published.items())
    ]
    TEXT_SNAPSHOT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_text_blocks() -> dict:
    """Ordre de priorité (voir plan, point « une seule source de
    vérité ») : Supabase (source de vérité) en premier ; si injoignable,
    le dernier instantané déjà committé (jamais l'ancien texte d'origine
    du dépôt, qui régresserait silencieusement une publication récente
    en cas de simple incident réseau pendant un build) ; le texte
    d'origine du fragment ne s'applique que si AUCUNE des deux sources
    n'a de valeur pour un bloc donné (géré par substitute_text_blocks)."""
    fetched = fetch_published_text_blocks()
    if fetched is not None:
        save_text_snapshot(fetched)
        return fetched
    print("Avertissement : utilisation de l'instantané de textes déjà committé (Supabase injoignable).")
    return load_text_snapshot()


TEXT_MARKER_RE_TEMPLATE = r"<!-- TEXT:{block_key}:{field} -->(.*?)<!-- /TEXT -->"
TEXT_ANCHOR_RE = re.compile(r'(<a\b[^>]*?\bhref=")[^"]*(")([^>]*>)(.*?)(</a>)', re.DOTALL)


def _substitute_text_field(content: str, block_key: str, field: str, render) -> str:
    """Remplace le contenu entre <!-- TEXT:block_key:field --> et
    <!-- /TEXT --> par render(texte_actuel) -> nouveau HTML, pour TOUTES
    les occurrences du marqueur (ex. le titre d'une proposition apparaît
    à la fois recto et verso, avec le même block_key:field — les deux
    doivent changer ensemble). Les commentaires marqueurs restent dans la
    sortie (invisibles, servent aussi d'ancrage à l'aperçu live dans
    /gestion). Une occurrence est laissée telle quelle si render renvoie
    None pour elle (rien à publier pour ce champ)."""
    pattern = re.compile(TEXT_MARKER_RE_TEMPLATE.format(block_key=re.escape(block_key), field=field), re.DOTALL)

    def repl(match: re.Match) -> str:
        replacement = render(match.group(1))
        if replacement is None:
            return match.group(0)
        return f"<!-- TEXT:{block_key}:{field} -->{replacement}<!-- /TEXT -->"

    return pattern.sub(repl, content)


def substitute_text_blocks(content: str, page_slug: str, published: dict) -> str:
    for block in TEXT_BLOCKS:
        if block["page"] != page_slug:
            continue
        row = published.get((page_slug, block["block_key"]))
        if not row:
            continue
        for field in block["fields"]:
            if field == "button":
                label = row.get("button_label")
                url = row.get("button_url")
                if not label or not url or not is_safe_url(url):
                    continue
                content = _substitute_text_field(
                    content, block["block_key"], "button",
                    lambda current, label=label, url=url: TEXT_ANCHOR_RE.sub(
                        lambda m: f"{m.group(1)}{html.escape(url, quote=True)}{m.group(2)}{m.group(3)}{html.escape(label)}{m.group(5)}",
                        current, count=1,
                    ) if TEXT_ANCHOR_RE.search(current) else None,
                )
                continue
            value = row.get(field)
            if not value:
                continue
            if field == "body":
                rendered = render_body(value)
            elif field == "lead":
                rendered = render_lead(value)
            else:
                rendered = html.escape(value)
            content = _substitute_text_field(content, block["block_key"], field, lambda current, rendered=rendered: rendered)
    return content


def fetch_enabled_postcard_categories() -> dict:
    """{section_slug: visible_count} pour les catégories où la rotation
    aléatoire de cartes postales est activée (/gestion > Cartes postales).
    En cas d'erreur réseau/API, ou si aucune catégorie n'est activée
    (état par défaut aujourd'hui), renvoie {} : chaque page garde alors son
    rendu Emplacements actuel (photos fixes par slot_key), inchangé."""
    url = (
        f"{SUPABASE_URL}/rest/v1/l5d2lm_postcard_configs"
        f"?enabled=eq.true&select=visible_count,section:l5d2lm_sections(slug)"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {SUPABASE_PUBLISHABLE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"Avertissement : catégories de cartes postales non récupérées ({exc}) — Emplacements conservé.")
        return {}

    enabled = {}
    for row in rows:
        section = row.get("section")
        if section and section.get("slug"):
            enabled[section["slug"]] = row.get("visible_count") or 1
    return enabled


def fetch_postcard_pools(section_slugs: list) -> dict:
    """{section_slug: [{src, alt, annotation}, ...]} pour les catégories
    passées, triés par sort_order. N'est appelé que si des catégories sont
    activées (voir fetch_enabled_postcard_categories)."""
    if not section_slugs:
        return {}
    url = (
        f"{SUPABASE_URL}/rest/v1/l5d2lm_media_usages"
        f"?role=eq.postcard&active=eq.true&order=sort_order.asc"
        f"&select=sort_order,annotation_override,alt_override,"
        f"section:l5d2lm_sections(slug),"
        f"media:l5d2lm_media(public_path,alt_text,default_annotation)"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {SUPABASE_PUBLISHABLE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"Avertissement : pool de cartes postales non récupéré ({exc}) — Emplacements conservé.")
        return {}

    pools: dict = {}
    seen_src: dict = {}
    slugs = set(section_slugs)
    for row in rows:
        section = row.get("section")
        media = row.get("media")
        if not section or not media or section.get("slug") not in slugs or not media.get("public_path"):
            continue
        slug = section["slug"]
        src = _slot_image_src(media)
        # Une même photo ne doit jamais apparaître deux fois dans le rendu
        # de repli (avant tirage côté navigateur) : ne garder que la
        # première occurrence par catégorie, même si elle a été ajoutée en
        # double au pool depuis /gestion.
        seen = seen_src.setdefault(slug, set())
        if src in seen:
            continue
        seen.add(src)
        pools.setdefault(slug, []).append({
            "src": src,
            "alt": row.get("alt_override") or media.get("alt_text") or "",
            "annotation": row.get("annotation_override") or media.get("default_annotation") or "",
        })
    return pools


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


def render_float_slot(slot: dict, media: dict | None) -> str:
    # Ancrage optionnel : rien tant que l'admin n'a pas choisi de photo
    # (pas de "Photo à venir" au milieu d'un paragraphe existant).
    if not media:
        return ""
    src = html.escape(_slot_image_src(media), quote=True)
    alt = html.escape(media.get("alt_text") or "", quote=True)
    side = "left" if slot.get("float_side") == "left" else "right"
    return f'<div class="anchor-photo anchor-photo--{side}"><img src="{src}" alt="{alt}" loading="lazy"></div>'


def render_band_slot(slot: dict, media: dict | None) -> str:
    if not media:
        return ""
    src = html.escape(_slot_image_src(media), quote=True)
    alt = html.escape(media.get("alt_text") or "", quote=True)
    return f'<div class="photo-single"><img src="{src}" alt="{alt}" loading="lazy"></div>'


def render_slot(slot: dict, media: dict | None) -> str:
    kind = slot.get("kind")
    if kind == "postcard":
        return render_postcard_slot(slot, media)
    if kind == "float":
        return render_float_slot(slot, media)
    if kind == "band":
        return render_band_slot(slot, media)
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


PHOTO_BAND_RE = re.compile(r'<div class="photo-band">.*?</div>\n?', re.DOTALL)


def render_postcard_band(section_slug: str, visible_count: int, pool: list) -> str:
    shown = pool[:visible_count]
    cards = "\n".join(
        '      <div class="postcard"><img src="{src}" alt="{alt}" title="{title}"></div>'.format(
            src=html.escape(item["src"], quote=True),
            alt=html.escape(item["alt"], quote=True),
            title=html.escape(item["annotation"], quote=True),
        )
        for item in shown
    )
    # Le pool complet est embarqué en JSON pour le tirage aléatoire côté
    # navigateur (voir l5d2lm-script.js) ; les cartes ci-dessus servent de
    # rendu de repli tant que le script n'a pas encore tourné (et pour les
    # visiteurs sans JavaScript).
    payload = json.dumps(pool, ensure_ascii=False).replace("</script", "<\\/script")
    return (
        f'<div class="photo-band" data-postcard-band="{html.escape(section_slug, quote=True)}" '
        f'data-visible-count="{visible_count}">\n'
        f"{cards}\n"
        "    </div>\n"
        f'    <script type="application/json" data-postcard-pool="{html.escape(section_slug, quote=True)}">'
        f"{payload}</script>\n"
    )


def substitute_postcard_band(
    content: str, page_slug: str, enabled_categories: dict, postcard_pools: dict
) -> str:
    """Remplace toute la bande <div class="photo-band">...</div> par le
    pool de rotation d'une catégorie si elle a activé la rotation
    aléatoire (/gestion > Cartes postales). Sinon, laisse le contenu
    inchangé : chaque bande garde son rendu Emplacements (slot_key fixes,
    voir substitute_media_slots) — c'est l'état par défaut aujourd'hui."""
    section_slug = POSTCARD_CATEGORY_SECTION_SLUGS.get(page_slug)
    if not section_slug or section_slug not in enabled_categories:
        return content
    visible_count = enabled_categories[section_slug]
    pool = postcard_pools.get(section_slug, [])
    if not pool:
        return content
    replacement = render_postcard_band(section_slug, visible_count, pool)
    return PHOTO_BAND_RE.sub(replacement, content, count=1)


NAV_ITEM_RE = re.compile(
    r"<!-- NAV_ITEM:([\w-]+) -->.*?<!-- /NAV_ITEM -->\n?", re.DOTALL
)


def substitute_nav_visibility(html_str: str, published_section_slugs: set[str] | None) -> str:
    """Retire tout bloc <!-- NAV_ITEM:slug -->...<!-- /NAV_ITEM --> dont la
    catégorie correspondante n'est pas publiée — utilisé pour le menu
    (chrome.html), le pied de page (footer.html) ET les liens vers une
    catégorie à l'intérieur du contenu d'une page (ex. les cartes
    "Propositions" de l'accueil) : mêmes marqueurs, même règle partout,
    pour qu'une catégorie masquée disparaisse de tous les endroits où le
    site y renvoie, pas seulement du menu. published_section_slugs=None
    (erreur réseau) => rien n'est retiré, par prudence."""
    if published_section_slugs is None:
        return html_str
    def repl(match: re.Match) -> str:
        slug = match.group(1)
        return match.group(0) if slug in published_section_slugs else ""
    return NAV_ITEM_RE.sub(repl, html_str)


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
    footer: str,
    published_activity_slugs: set[str] | None,
    published_section_slugs: set[str] | None,
    enabled_postcard_categories: dict,
    postcard_pools: dict,
    published_text_blocks: dict,
) -> None:
    head = render_head(page, published_section_slugs)
    content = (ROOT / f'content/{page["slug"]}.html').read_text(encoding="utf-8")
    # Doit tourner AVANT substitute_media_slots : cette dernière insère des
    # <div class="postcard"> imbriqués dans .photo-band, ce qui casserait
    # PHOTO_BAND_RE (non gourmande, s'arrêterait au premier </div> imbriqué
    # au lieu de celui de .photo-band). Tant que le marqueur MEDIA_SLOT est
    # encore un simple commentaire, le remplacement est sans ambiguïté.
    content = substitute_postcard_band(content, page["slug"], enabled_postcard_categories, postcard_pools)
    content = substitute_media_slots(content, page["slug"], published_slots)
    content = substitute_activity_blocks(content, published_activity_slugs)
    content = substitute_text_blocks(content, page["slug"], published_text_blocks)
    # Mêmes marqueurs NAV_ITEM que le menu (voir substitute_nav_visibility) :
    # une catégorie masquée disparaît aussi des liens qui y renvoient à
    # l'intérieur d'une page (ex. les cartes "Propositions" de l'accueil).
    content = substitute_nav_visibility(content, published_section_slugs)
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
    enabled_postcard_categories = fetch_enabled_postcard_categories()
    postcard_pools = fetch_postcard_pools(list(enabled_postcard_categories.keys()))
    published_text_blocks = resolve_text_blocks()
    chrome = (ROOT / "_partials/chrome.html").read_text(encoding="utf-8")
    chrome = substitute_nav_visibility(chrome, published_section_slugs)
    footer = (ROOT / "_partials/footer.html").read_text(encoding="utf-8")
    footer = substitute_text_blocks(footer, "__commun__", published_text_blocks)
    footer = substitute_nav_visibility(footer, published_section_slugs)
    for page in PAGES:
        build_page(
            page,
            published_slots,
            chrome,
            footer,
            published_activity_slugs,
            published_section_slugs,
            enabled_postcard_categories,
            postcard_pools,
            published_text_blocks,
        )
    build_sitemap(published_section_slugs)
    print(f"{len(PAGES)} pages générées + sitemap.xml")


if __name__ == "__main__":
    main()
