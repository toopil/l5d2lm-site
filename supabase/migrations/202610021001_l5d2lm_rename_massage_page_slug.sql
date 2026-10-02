-- Renomme la page Massage : l5d2lm-massage-intuitif-reveil-energetique.html
-- devient l5d2lm-massage.html. Le code (build/pages.py, build/texts.py,
-- build/slots.py, gestion/gestion.js) a déjà été mis à jour pour utiliser
-- le nouveau slug "l5d2lm-massage" — sans cette migration, les textes déjà
-- publiés pour cette page (page_slug = l'ancien slug) deviendraient
-- invisibles au prochain build (plus aucune ligne ne correspondrait au
-- nouveau slug recherché).
--
-- Met à jour TOUTES les lignes (publiées, brouillons, archivées pour
-- l'historique) : aucune perte de contenu ni d'historique.
update public.l5d2lm_text_blocks
  set page_slug = 'l5d2lm-massage'
  where page_slug = 'l5d2lm-massage-intuitif-reveil-energetique';
