-- Permet d'afficher/masquer depuis l'admin (Site > Structure) :
-- - une page entière du site public (déjà possible : le statut d'une
--   catégorie de premier niveau existait déjà, seul build.py ne le lisait
--   pas encore — voir la migration suivante côté code) ;
-- - une activité précise à l'intérieur d'une page (nouveau : des
--   catégories enfants de kind='proposal', déjà prévu par le schéma
--   d'origine mais jamais utilisé jusqu'ici).
--
-- Additif uniquement : ne touche a aucune donnee existante, ne modifie
-- aucune table Mission Declic. Idempotent (on conflict do nothing) : sans
-- effet si déjà exécutée, et sans effet si les 6 catégories du site
-- n'ont pas encore été créées (les insert...select ne trouvent alors
-- simplement aucun parent, rien n'est inséré).
--
-- Toutes les activités déjà visibles sur le site aujourd'hui sont créées
-- avec status='published' : aucune régression, l'admin peut ensuite les
-- masquer une par une depuis Site > Structure (mêmes boutons que pour les
-- catégories : Masquer / Mettre en brouillon / Publier).

insert into public.l5d2lm_sections (parent_id, slug, title, kind, status, sort_order)
select parent.id, activity.slug, activity.title, 'proposal', 'published', activity.sort_order
from (values
  ('corps-expression', 'playful-extatique', 'Playful extatique', 10),
  ('corps-expression', 'theatre-improvisation', 'Théâtre d''improvisation', 20),
  ('corps-expression', 'reveil-du-corps', 'Réveil du corps', 30),
  ('corps-expression', 'jeux-de-mouvement', 'Jeux de mouvement', 40),
  ('corps-expression', 'a-portee-de-main', 'À portée de main', 50),
  ('massage', 'massage-intuitif', 'Massage intuitif', 10),
  ('massage', 'reveil-energetique', 'Réveil énergétique', 20),
  ('massage', 'massage-aquatique', 'Massage aquatique', 30),
  ('massage', 'formation', 'Formation', 40)
) as activity(parent_slug, slug, title, sort_order)
join public.l5d2lm_sections parent
  on parent.slug = activity.parent_slug and parent.parent_id is null
on conflict (slug) do nothing;
