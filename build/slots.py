"""Emplacements photo fixes du site public, gérés depuis /gestion.

Chaque entrée correspond à un marqueur `<!-- MEDIA_SLOT:slot_key -->` dans
un fragment content/*.html. build.py les remplace à la génération par la
photo publiée pour ce slot_key (l5d2lm_media_usages côté Supabase) ; à
défaut, par la photo `fallback` (déjà présente dans le dépôt avant ce
mécanisme) si elle est définie, sinon par un repère "Photo à venir".

Le fallback évite toute régression silencieuse : tant que personne n'a
publié explicitement une photo pour un emplacement depuis Emplacements,
la photo déjà en place avant ce mécanisme continue de s'afficher
normalement.

Quatre formats (`kind`) :
- "proposition" (Corps & expression) : bande large avec numéro et texte
  "Photo à venir" en l'absence de photo.
- "postcard" (bandes de cartes postales : Accueil, Massage, Colo,
  Animation participative, Espaces à découvrir) : simple vignette
  `<div class="postcard"><img ...></div>`, sans numéro ni texte.
- "float" (photo qui flotte à côté d'un paragraphe existant, le texte se
  réorganise autour — champ supplémentaire `float_side`, "left" ou
  "right") : aucune photo assignée = rien n'est affiché (ancrage
  optionnel, pas de "Photo à venir" au milieu d'un paragraphe).
- "band" (photo seule, pleine largeur, entre deux sections existantes) :
  même règle, rien n'est affiché tant qu'aucune photo n'est choisie.

Étendre à une nouvelle page = ajouter des entrées ici + le marqueur
correspondant dans le fragment ; aucune autre infrastructure à toucher.
"""

SLOTS = [
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:playful-extatique",
        kind="proposition",
        band_number="01",
        title="Playful extatique",
        fallback=dict(src="l5d2lm-photo-corps-expression-2.jpg", width="420", height="315"),
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:theatre-improvisation",
        kind="proposition",
        band_number="02",
        title="Théâtre d’improvisation",
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:reveil-du-corps",
        kind="proposition",
        band_number="03",
        title="Réveil du corps",
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:jeux-de-mouvement",
        kind="proposition",
        band_number="04",
        title="Jeux de mouvement",
        fallback=dict(src="l5d2lm-photo-corps-expression-jeux.jpg", width="1000", height="758"),
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:a-portee-de-main",
        kind="proposition",
        band_number="05",
        title="À portée de main",
        fallback=dict(src="l5d2lm-photo-corps-expression-4.jpg", width="420", height="560"),
    ),
    # Ancrages photo optionnels (voir docstring) : aucune photo par défaut,
    # aucun changement visuel tant que rien n'est assigné depuis
    # /gestion > Emplacements.
    dict(page="l5d2lm-corps-expression", slot_key="corps-expression:anchor-band-hero", kind="band",
         title="Corps & expression — bande entre le hero et les propositions"),
    dict(page="l5d2lm-corps-expression", slot_key="corps-expression:anchor-band-cadre", kind="band",
         title="Corps & expression — bande avant « Un cadre commun »"),
    dict(page="l5d2lm-corps-expression", slot_key="corps-expression:anchor-float-cadre", kind="float", float_side="left",
         title="Corps & expression — flottante à côté de « Un cadre commun »"),
    dict(page="l5d2lm-corps-expression", slot_key="corps-expression:anchor-band-footer", kind="band",
         title="Corps & expression — bande avant le bas de page"),

    dict(page="l5d2lm-index", slot_key="accueil:postcard-1", kind="postcard", title="Accueil — carte postale 1", fallback=dict(src="l5d2lm-photo-index.jpg")),
    dict(page="l5d2lm-index", slot_key="accueil:postcard-2", kind="postcard", title="Accueil — carte postale 2", fallback=dict(src="l5d2lm-photo-index-2.jpg")),
    dict(page="l5d2lm-index", slot_key="accueil:anchor-band-hero", kind="band",
         title="Accueil — bande entre l’accueil et Propositions"),
    dict(page="l5d2lm-index", slot_key="accueil:anchor-float-formats", kind="float", float_side="right",
         title="Accueil — flottante à côté de « Des formats qui se construisent ensemble »"),
    dict(page="l5d2lm-index", slot_key="accueil:anchor-band-footer", kind="band",
         title="Accueil — bande avant le bas de page"),

    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-1", kind="postcard", title="Massage — carte postale 1", fallback=dict(src="l5d2lm-photo-massage-intuitif.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-2", kind="postcard", title="Massage — carte postale 2", fallback=dict(src="l5d2lm-photo-massage-2.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-3", kind="postcard", title="Massage — carte postale 3", fallback=dict(src="l5d2lm-photo-massage-3.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-4", kind="postcard", title="Massage — carte postale 4", fallback=dict(src="l5d2lm-photo-massage-4.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:anchor-float-chenda", kind="float", float_side="right",
         title="Massage — flottante à côté de « Espace Chèndâ »"),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:anchor-float-deroulement", kind="float", float_side="left",
         title="Massage — flottante à côté de « Comment se déroule une séance ? »"),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:anchor-float-qui-masse", kind="float", float_side="right",
         title="Massage — flottante à côté de « Qui masse ? »"),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:anchor-band-transmission", kind="band",
         title="Massage — bande avant « Recevoir, ou apprendre à transmettre »"),

    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-1", kind="postcard", title="Colo pour adultes — carte postale 1", fallback=dict(src="l5d2lm-photo-colo.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-2", kind="postcard", title="Colo pour adultes — carte postale 2", fallback=dict(src="l5d2lm-photo-colo-2.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-3", kind="postcard", title="Colo pour adultes — carte postale 3", fallback=dict(src="l5d2lm-photo-colo-3.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-4", kind="postcard", title="Colo pour adultes — carte postale 4", fallback=dict(src="l5d2lm-photo-colo-4.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-5", kind="postcard", title="Colo pour adultes — carte postale 5", fallback=dict(src="l5d2lm-photo-colo-5.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:anchor-float-intro", kind="float", float_side="right",
         title="Colo pour adultes — flottante dans l’introduction"),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:anchor-float-magie", kind="float", float_side="left",
         title="Colo pour adultes — flottante à côté de « La magie de chacun »"),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:anchor-band-pratique", kind="band",
         title="Colo pour adultes — bande avant « Quelques repères simples »"),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:anchor-band-footer", kind="band",
         title="Colo pour adultes — bande avant le bas de page"),

    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-1", kind="postcard", title="Animation participative — carte postale 1", fallback=dict(src="l5d2lm-photo-animation.jpg")),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-2", kind="postcard", title="Animation participative — carte postale 2", fallback=dict(src="l5d2lm-photo-animation-2.jpg")),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-3", kind="postcard", title="Animation participative — carte postale 3", fallback=dict(src="l5d2lm-photo-animation-3.jpg")),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:anchor-band-hero", kind="band",
         title="Animation participative — bande avant la mallette d’outils"),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:anchor-float-souvenirs", kind="float", float_side="right",
         title="Animation participative — flottante à côté de « Photos de groupe »"),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:anchor-band-principes", kind="band",
         title="Animation participative — bande avant les principes"),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:anchor-band-finale", kind="band",
         title="Animation participative — bande avant la section finale"),

    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-1", kind="postcard", title="Espaces à découvrir — carte postale 1", fallback=dict(src="l5d2lm-photo-espaces.jpg")),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-2", kind="postcard", title="Espaces à découvrir — carte postale 2", fallback=dict(src="l5d2lm-photo-espaces-2.jpg")),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-3", kind="postcard", title="Espaces à découvrir — carte postale 3", fallback=dict(src="l5d2lm-photo-espaces-3.jpg")),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:anchor-band-initiatives", kind="band",
         title="Espaces à découvrir — bande sous « Initiatives à explorer »"),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:anchor-band-footer", kind="band",
         title="Espaces à découvrir — bande avant le bas de page"),
]

# Pages avec une bande de cartes postales -> slug l5d2lm_sections de la
# catégorie correspondante. Utilisé par le mécanisme optionnel de
# rotation aléatoire par catégorie (voir /gestion > Cartes postales) :
# quand la catégorie a une configuration l5d2lm_postcard_configs activée,
# build.py remplace toute la bande "postcard-N" ci-dessus par un pool
# plus large piocher côté navigateur, au lieu des slot_key fixes.
POSTCARD_CATEGORY_SECTION_SLUGS = {
    "l5d2lm-index": "accueil",
    "l5d2lm-massage-intuitif-reveil-energetique": "massage",
    "l5d2lm-colos-sejours": "colo-pour-adultes",
    "l5d2lm-animations-participatives": "animations-participatives",
    "l5d2lm-espaces-a-decouvrir": "espaces-a-decouvrir",
}
