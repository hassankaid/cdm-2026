-- =====================================================================
-- 0013_match_markers — repères de timeline "mi-temps" et "fin du match"
-- Ajoute deux valeurs à l'enum event_type pour matérialiser ces moments
-- dans le fil du match (rendus comme séparateurs centrés côté front).
-- =====================================================================
alter type event_type add value if not exists 'halftime';
alter type event_type add value if not exists 'fulltime';
