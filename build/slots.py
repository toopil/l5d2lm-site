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

Deux formats (`kind`) :
- "proposition" (Corps & expression) : bande large avec numéro et texte
  "Photo à venir" en l'absence de photo.
- "postcard" (bandes de cartes postales : Accueil, Massage, Colo,
  Animation participative, Espaces à découvrir) : simple vignette
  `<div class="postcard"><img ...></div>`, sans numéro ni texte.

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

    dict(page="l5d2lm-index", slot_key="accueil:postcard-1", kind="postcard", title="Accueil — carte postale 1", fallback=dict(src="l5d2lm-photo-index.jpg")),
    dict(page="l5d2lm-index", slot_key="accueil:postcard-2", kind="postcard", title="Accueil — carte postale 2", fallback=dict(src="l5d2lm-photo-index-2.jpg")),

    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-1", kind="postcard", title="Massage — carte postale 1", fallback=dict(src="l5d2lm-photo-massage-intuitif.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-2", kind="postcard", title="Massage — carte postale 2", fallback=dict(src="l5d2lm-photo-massage-2.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-3", kind="postcard", title="Massage — carte postale 3", fallback=dict(src="l5d2lm-photo-massage-3.jpg")),
    dict(page="l5d2lm-massage-intuitif-reveil-energetique", slot_key="massage:postcard-4", kind="postcard", title="Massage — carte postale 4", fallback=dict(src="l5d2lm-photo-massage-4.jpg")),

    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-1", kind="postcard", title="Colo pour adultes — carte postale 1", fallback=dict(src="l5d2lm-photo-colo.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-2", kind="postcard", title="Colo pour adultes — carte postale 2", fallback=dict(src="l5d2lm-photo-colo-2.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-3", kind="postcard", title="Colo pour adultes — carte postale 3", fallback=dict(src="l5d2lm-photo-colo-3.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-4", kind="postcard", title="Colo pour adultes — carte postale 4", fallback=dict(src="l5d2lm-photo-colo-4.jpg")),
    dict(page="l5d2lm-colos-sejours", slot_key="colo:postcard-5", kind="postcard", title="Colo pour adultes — carte postale 5", fallback=dict(src="l5d2lm-photo-colo-5.jpg")),

    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-1", kind="postcard", title="Animation participative — carte postale 1", fallback=dict(src="l5d2lm-photo-animation.jpg")),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-2", kind="postcard", title="Animation participative — carte postale 2", fallback=dict(src="l5d2lm-photo-animation-2.jpg")),
    dict(page="l5d2lm-animations-participatives", slot_key="animation:postcard-3", kind="postcard", title="Animation participative — carte postale 3", fallback=dict(src="l5d2lm-photo-animation-3.jpg")),

    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-1", kind="postcard", title="Espaces à découvrir — carte postale 1", fallback=dict(src="l5d2lm-photo-espaces.jpg")),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-2", kind="postcard", title="Espaces à découvrir — carte postale 2", fallback=dict(src="l5d2lm-photo-espaces-2.jpg")),
    dict(page="l5d2lm-espaces-a-decouvrir", slot_key="espaces:postcard-3", kind="postcard", title="Espaces à découvrir — carte postale 3", fallback=dict(src="l5d2lm-photo-espaces-3.jpg")),
]
