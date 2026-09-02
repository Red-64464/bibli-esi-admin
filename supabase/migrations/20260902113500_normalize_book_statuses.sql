-- Le front utilise des valeurs stables sans accents. Les anciennes valeurs
-- sont converties une seule fois afin que filtres, édition et imports restent
-- cohérents avec la contrainte de la base.
update public.bibli_livres
set statut = case statut
  when 'emprunté' then 'emprunte'
  when 'réservé' then 'reserve'
  when 'indisponible' then 'en_reparation'
  else statut
end
where statut in ('emprunté', 'réservé', 'indisponible');

alter table public.bibli_livres
  drop constraint if exists bibli_livres_statut_check;

alter table public.bibli_livres
  add constraint bibli_livres_statut_check
  check (statut in ('disponible', 'emprunte', 'reserve', 'perdu', 'en_reparation'));
