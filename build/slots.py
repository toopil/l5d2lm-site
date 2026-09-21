"""Emplacements photo fixes du site public, gérés depuis /gestion.

Chaque entrée correspond à un marqueur `<!-- MEDIA_SLOT:slot_key -->` dans
un fragment content/*.html. build.py les remplace à la génération par la
photo publiée pour ce slot_key (l5d2lm_media_usages côté Supabase) ; à
défaut, par la photo `fallback` (déjà présente dans le dépôt avant ce
mécanisme) si elle est définie, sinon par un repère "Photo à venir".

Le fallback évite toute régression silencieuse : tant que personne n'a
publié explicitement une photo pour un emplacement depuis Site >
Emplacements, la photo déjà en place avant ce mécanisme continue de
s'afficher normalement.

Étendre à une nouvelle page = ajouter des entrées ici + le marqueur
correspondant dans le fragment ; aucune autre infrastructure à toucher.
"""

SLOTS = [
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:playful-extatique",
        band_number="01",
        title="Playful extatique",
        fallback=dict(src="l5d2lm-photo-corps-expression-2.jpg", width="420", height="315"),
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:theatre-improvisation",
        band_number="02",
        title="Théâtre d’improvisation",
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:reveil-du-corps",
        band_number="03",
        title="Réveil du corps",
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:jeux-de-mouvement",
        band_number="04",
        title="Jeux de mouvement",
        fallback=dict(src="l5d2lm-photo-corps-expression-jeux.jpg", width="1000", height="758"),
    ),
    dict(
        page="l5d2lm-corps-expression",
        slot_key="corps-expression:a-portee-de-main",
        band_number="05",
        title="À portée de main",
        fallback=dict(src="l5d2lm-photo-corps-expression-4.jpg", width="420", height="560"),
    ),
]
