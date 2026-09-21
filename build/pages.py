BASE_URL = "https://toopil.github.io/l5d2lm-site"

# section_slug relie une page à sa catégorie l5d2lm_sections (créée depuis
# /gestion via "Créer les 6 catégories du site") : si cette catégorie
# passe en brouillon/masquée, build.py retire la page de la navigation et
# du sitemap (voir fetch_published_section_slugs). None = toujours visible
# (page utilitaire sans catégorie correspondante : contact, mentions
# légales, page en construction).
PAGES = [
    dict(slug="l5d2lm-index", title="Les 5 doigts de la main | Ateliers, massages et projets collectifs en Valais", description="Les 5 doigts de la main rassemble en Suisse romande et en France des ateliers, massages intuitifs, colos pour adultes, animations participatives et espaces pour créer du lien.", section_slug=None),
    dict(slug="l5d2lm-massage-intuitif-reveil-energetique", title="Massage intuitif, massage aquatique &amp; réveil énergétique en Valais", description="Massage intuitif, massage aquatique, réveil énergétique et formation collective en Valais, Suisse romande et événements sur demande.", section_slug="massage"),
    dict(slug="l5d2lm-corps-expression", title="Corps &amp; expression | Mouvement, jeu et danse consciente", description="Propositions Corps et expression : Playful extatique, théâtre d’improvisation, réveil du corps, jeux de mouvement et À portée de main.", section_slug="corps-expression"),
    dict(slug="l5d2lm-colos-sejours", title="Colo pour adultes | Un séjour construit avec le groupe", description="Une colo pour adultes à construire ensemble à partir de 15 participants : rencontres, jeux, partages et propositions apportées par le groupe.", section_slug="colo-pour-adultes"),
    dict(slug="l5d2lm-animations-participatives", title="Animation participative | Être acteur plutôt que spectateur", description="Une animation participative adaptable pour festivals, fêtes, associations et événements : jeux, mouvement, défis et photos de groupe marquantes.", section_slug="animations-participatives"),
    dict(slug="l5d2lm-espaces-a-decouvrir", title="Espaces à découvrir | Initiatives locales, lieux et projets inspirants", description="Espaces à découvrir rassemble des lieux, associations, écoles, initiatives et projets existants à faire connaître en Valais, Suisse romande et ailleurs.", section_slug="espaces-a-decouvrir"),
    dict(slug="l5d2lm-contact", title="Contact | Les 5 doigts de la main en Valais", description="Contact et demandes pour Les 5 doigts de la main : ateliers, massages, colos, animations ou espaces à découvrir.", section_slug=None),
    dict(slug="l5d2lm-mission-declic", title="Page en construction | Les 5 doigts de la main", description="Cette page des 5 doigts de la main est temporairement en construction.", robots="noindex", section_slug=None),
    dict(slug="l5d2lm-mentions-legales", title="Mentions légales | Les 5 doigts de la main", description="Mentions légales du site Les 5 doigts de la main : éditeur, contact et hébergement.", section_slug=None),
]
