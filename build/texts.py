"""Textes administrables du site public, gérés depuis /gestion > Site > Textes.

Chaque entrée de TEXT_BLOCKS correspond à un groupe de marqueurs
`<!-- TEXT:block_key:field --> ... <!-- /TEXT -->` dans un fragment
content/*.html — un marqueur par champ réellement utilisé par ce bloc
(title/eyebrow/lead/body/button_label/button_url). build.py les remplace
à la génération par le texte publié pour ce (block_key, field) dans
l5d2lm_text_blocks ; à défaut, le contenu actuel du fragment (déjà en
place avant ce mécanisme) reste affiché tel quel — jamais de régression
silencieuse tant que rien n'a été publié depuis l'admin.

Champs possibles par bloc (voir `fields` ci-dessous) :
- title   : texte brut (échappé), une ligne.
- eyebrow : texte brut (échappé), une ligne.
- lead    : texte brut (échappé), retours à la ligne simples -> <br>.
- body    : format restreint (voir render_body) -> plusieurs paragraphes,
  **gras**, *italique*, [texte](url), listes à puces "- item".
- button  : paire (button_label, button_url) — présente seulement si le
  bloc a un vrai bouton/lien administrable.

Étendre à une nouvelle page = ajouter des entrées ici + les marqueurs
correspondants dans le fragment ; aucune autre infrastructure à toucher
(même principe que SLOTS pour les photos).

Hors périmètre volontairement (voir plan) : tableaux de données
structurées (ex. availability-table), libellés d'interaction génériques
réutilisés partout ("Voir le détail", "← Retour", bouton court recto des
propositions), textes d'adresse postale.
"""

TEXT_BLOCKS = [
    dict(page="l5d2lm-index", block_key="accueil-hero",
         label="Accueil — présentation principale",
         fields=["eyebrow", "title", "lead", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-espaces-heading",
         label="Accueil — en-tête « Les grands espaces »",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-index", block_key="accueil-card-massage",
         label="Accueil — carte Massage",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-card-corps-expression",
         label="Accueil — carte Corps & expression",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-card-colo",
         label="Accueil — carte Colo pour adultes",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-card-animation",
         label="Accueil — carte Animations participatives",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-card-espaces",
         label="Accueil — carte Espaces à découvrir",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-formats",
         label="Accueil — « Des formats qui se construisent ensemble »",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-index", block_key="accueil-footprints",
         label="Accueil — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-hero",
         label="Massage — présentation principale",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-propositions-heading",
         label="Massage — en-tête « Trois propositions »",
         fields=["eyebrow", "title"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-intuitif",
         label="Massage — Massage intuitif",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="reveil-energetique",
         label="Massage — Réveil énergétique",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-aquatique",
         label="Massage — Massage aquatique",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-practical-heading",
         label="Massage — en-tête « Quelques repères simples »",
         fields=["eyebrow", "title"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-practical-deroulement",
         label="Massage — « Comment se déroule une séance ? »",
         fields=["title", "body"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-practical-parler",
         label="Massage — « Faut-il parler pendant la séance ? »",
         fields=["title", "body"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-practical-premiere-fois",
         label="Massage — « Et si c’est une première fois ? »",
         fields=["title", "body"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-chenda",
         label="Massage — Espace Chèndâ",
         fields=["eyebrow", "title", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-qui-masse",
         label="Massage — Qui masse ?",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-training-heading",
         label="Massage — en-tête « Recevoir, ou apprendre à transmettre »",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-training-recevoir",
         label="Massage — Recevoir un réveil énergétique",
         fields=["eyebrow", "title", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-training-transmettre",
         label="Massage — Apprendre à transmettre",
         fields=["eyebrow", "title", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-cta",
         label="Massage — Construire une proposition",
         fields=["eyebrow", "title", "body", "button"]),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", block_key="massage-footprints",
         label="Massage — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-corps-expression", block_key="corps-expression-hero",
         label="Corps & expression — présentation principale",
         fields=["eyebrow", "title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="corps-expression-propositions-heading",
         label="Corps & expression — en-tête « Cinq propositions »",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-corps-expression", block_key="playful-extatique",
         label="Corps & expression — Playful extatique",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="theatre-improvisation",
         label="Corps & expression — Théâtre d’improvisation",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="reveil-du-corps",
         label="Corps & expression — Réveil du corps",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="jeux-de-mouvement",
         label="Corps & expression — Jeux de mouvement",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="a-portee-de-main",
         label="Corps & expression — À portée de main",
         fields=["title", "lead", "body", "button"]),
    dict(page="l5d2lm-corps-expression", block_key="corps-expression-cadre",
         label="Corps & expression — « Un cadre commun »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-corps-expression", block_key="corps-expression-footprints",
         label="Corps & expression — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-colos-sejours", block_key="colo-hero",
         label="Colo pour adultes — présentation principale",
         fields=["eyebrow", "title", "lead", "body", "button"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-collective-heading",
         label="Colo pour adultes — « Une expérience collective »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-magie",
         label="Colo pour adultes — « La magie de chacun »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-practical-depart",
         label="Colo pour adultes — « À partir de 15 adultes »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-practical-construction",
         label="Colo pour adultes — « Selon le groupe »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-practical-actions",
         label="Colo pour adultes — « Participer ou soutenir »",
         fields=["eyebrow", "title", "button"]),
    dict(page="l5d2lm-colos-sejours", block_key="colo-footprints",
         label="Colo pour adultes — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-animations-participatives", block_key="animation-hero",
         label="Animation participative — présentation principale",
         fields=["eyebrow", "title", "lead", "body", "button"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-mallette-heading",
         label="Animation participative — en-tête « Une mallette d’outils »",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-toolbox-rencontrer",
         label="Animation participative — « Se rencontrer »",
         fields=["title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-toolbox-jouer",
         label="Animation participative — « Jouer et essayer »",
         fields=["title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-toolbox-creer",
         label="Animation participative — « Créer ensemble »",
         fields=["title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-souvenirs",
         label="Animation participative — « Photos de groupe »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-essentiel",
         label="Animation participative — « L’essentiel »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-duree-public",
         label="Animation participative — « Durée et public »",
         fields=["eyebrow", "title", "body"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-cta",
         label="Animation participative — appel à l’action final",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-animations-participatives", block_key="animation-footprints",
         label="Animation participative — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espaces-hero",
         label="Espaces à découvrir — présentation principale",
         fields=["eyebrow", "title", "lead", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espaces-initiatives-heading",
         label="Espaces à découvrir — en-tête « Initiatives à explorer »",
         fields=["eyebrow", "title"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-satellite",
         label="Espaces à découvrir — Le Satellite",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-archipel",
         label="Espaces à découvrir — L’Archipel",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-aslec",
         label="Espaces à découvrir — ASLEC",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-kairos",
         label="Espaces à découvrir — Association Kaïros",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-digestif",
         label="Espaces à découvrir — Compagnie Digestif / Treffpunkt Tschüdanga",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-akenes",
         label="Espaces à découvrir — École aux Akènes",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-educaterre",
         label="Espaces à découvrir — EducaTerre",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-mandala",
         label="Espaces à découvrir — Mandala Schule",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-canopee",
         label="Espaces à découvrir — Épicerie La Canopée",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-terraformation",
         label="Espaces à découvrir — Terra Formation",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-agroecologie",
         label="Espaces à découvrir — Journées de l’Agroécologie",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-passeport-possibles",
         label="Espaces à découvrir — Passeport des possibles",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-transports-gratuits",
         label="Espaces à découvrir — Transports publics gratuits",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espace-sentiers-savoirs",
         label="Espaces à découvrir — Sentiers des Savoirs",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-espaces-a-decouvrir", block_key="espaces-footprints",
         label="Espaces à découvrir — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-contact", block_key="contact-hero",
         label="Contact — présentation principale",
         fields=["eyebrow", "title", "lead", "body"]),
    dict(page="l5d2lm-contact", block_key="contact-demande-heading",
         label="Contact — en-tête « Demande »",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-contact", block_key="contact-note",
         label="Contact — bloc « Écrire simplement »",
         fields=["title", "body", "button"]),
    dict(page="l5d2lm-contact", block_key="contact-footprints",
         label="Contact — bandeau de bas de page",
         fields=["lead"]),

    dict(page="l5d2lm-mentions-legales", block_key="mentions-hero",
         label="Mentions légales — présentation principale",
         fields=["eyebrow", "title", "lead"]),
    dict(page="l5d2lm-mentions-legales", block_key="mentions-editeur",
         label="Mentions légales — Éditeur du site",
         fields=["title", "body"]),
    dict(page="l5d2lm-mentions-legales", block_key="mentions-contact",
         label="Mentions légales — Contact",
         fields=["title", "body"]),
    dict(page="l5d2lm-mentions-legales", block_key="mentions-hebergement",
         label="Mentions légales — Hébergement",
         fields=["title", "body"]),
    dict(page="l5d2lm-mentions-legales", block_key="mentions-footprints",
         label="Mentions légales — bandeau de bas de page",
         fields=["lead"]),

    # page="__commun__" : pas une vraie page, mais le pied de page partagé
    # par toutes les pages (voir _partials/footer.html et main() dans
    # build.py, qui applique substitute_text_blocks(footer, "__commun__", ...)
    # une seule fois, avant la génération par page).
    dict(page="__commun__", block_key="commun-footer-tagline",
         label="Éléments communs — accroche du pied de page",
         fields=["lead"]),
]


# --- Rendu sécurisé du texte publié ------------------------------------
#
# L'admin ne saisit jamais de HTML : juste du texte avec une syntaxe
# restreinte (**gras**, *italique*, [texte](url), "- item" pour une
# liste, ligne vide = nouveau paragraphe, retour à la ligne simple =
# <br>). Cette conversion est le SEUL endroit qui produit du HTML à
# partir d'une saisie admin ; le vocabulaire de sortie est fixe
# (p/br/strong/em/a/ul/ol/li), donc rien d'autre ne peut jamais
# apparaître dans la page, quoi que l'admin tape.

import html
import re

_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_ITALIC_RE = re.compile(r"\*(.+?)\*")
_BULLET_RE = re.compile(r"^-\s+")
_NUMBERED_RE = re.compile(r"^\d+\.\s+")


def is_safe_url(url: str) -> bool:
    """Autorise http(s)://, mailto:, tel:, ancre (#...) ou chemin/fichier
    relatif (ex. l5d2lm-contact.html?...). Refuse tout le reste
    (javascript:, data:, vbscript:, etc.)."""
    url = (url or "").strip()
    if not url:
        return False
    if url.startswith(("http://", "https://", "mailto:", "tel:", "#", "/")):
        return True
    # Chemin/fichier relatif : pas de ":" avant le premier "/" ou "?".
    prefix = re.split(r"[/?]", url, maxsplit=1)[0]
    return ":" not in prefix


def _inline(escaped_text: str) -> str:
    def repl_link(match: re.Match) -> str:
        label, url = match.group(1), match.group(2)
        return f'<a href="{html.escape(url)}">{label}</a>' if is_safe_url(url) else label
    text = _LINK_RE.sub(repl_link, escaped_text)
    text = _BOLD_RE.sub(r"<strong>\1</strong>", text)
    text = _ITALIC_RE.sub(r"<em>\1</em>", text)
    return text


def render_lead(text: str) -> str:
    """Texte court : échappé, retours à la ligne simples -> <br>."""
    escaped = html.escape(text or "")
    return _inline(escaped).replace("\n", "<br>")


def render_body(text: str) -> str:
    """Texte riche : paragraphes, listes, gras/italique/liens."""
    text = (text or "").strip()
    if not text:
        return ""
    blocks = re.split(r"\n\s*\n", text)
    html_parts = []
    for block in blocks:
        lines = [line.strip() for line in block.strip().split("\n") if line.strip()]
        if not lines:
            continue
        if all(_BULLET_RE.match(line) for line in lines):
            items = "".join(f"<li>{_inline(html.escape(_BULLET_RE.sub('', line)))}</li>" for line in lines)
            html_parts.append(f"<ul>{items}</ul>")
        elif all(_NUMBERED_RE.match(line) for line in lines):
            items = "".join(f"<li>{_inline(html.escape(_NUMBERED_RE.sub('', line)))}</li>" for line in lines)
            html_parts.append(f"<ol>{items}</ol>")
        else:
            paragraph = "<br>".join(_inline(html.escape(line)) for line in lines)
            html_parts.append(f"<p>{paragraph}</p>")
    return "\n".join(html_parts)
