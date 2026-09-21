"""Emplacements photo fixes du site public, gérés depuis /gestion.

Chaque entrée correspond à un marqueur `<!-- MEDIA_SLOT:slot_key -->` dans
un fragment content/*.html. build.py les remplace à la génération par la
photo publiée pour ce slot_key (l5d2lm_media_usages côté Supabase), ou par
un repère "Photo à venir" si aucune n'est encore publiée.

Étendre à une nouvelle page = ajouter des entrées ici + le marqueur
correspondant dans le fragment ; aucune autre infrastructure à toucher.

Volontairement limité aux 2 propositions actuellement sans photo : les
3 autres (Playful extatique, Jeux de mouvement, À portée de main) ont déjà
leur photo en dur dans le fragment. Les faire aussi passer par ce mécanisme
demanderait de publier ces photos existantes dans Supabase au préalable
(upload dans le bucket public + ligne l5d2lm_media_usages), une action sur
la base réelle qui doit être faite depuis l'admin, pas décidée ici — sinon
un rebuild avant cette publication ferait disparaître ces 3 photos qui
fonctionnent déjà. À faire plus tard si l'admin veut aussi gérer celles-ci
depuis /gestion.
"""

SLOTS = [
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
]
