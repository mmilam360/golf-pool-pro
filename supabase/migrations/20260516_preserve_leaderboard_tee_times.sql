create or replace function public.gpp_preserve_leaderboard_enriched_fields(new_players jsonb, old_players jsonb)
returns jsonb
language plpgsql
as $$
declare
  old_by_name jsonb;
  merged jsonb;
begin
  if new_players is null or jsonb_typeof(new_players) <> 'array' then
    return new_players;
  end if;
  if old_players is null or jsonb_typeof(old_players) <> 'array' then
    return new_players;
  end if;

  select coalesce(jsonb_object_agg(player->>'name', player), '{}'::jsonb)
  into old_by_name
  from jsonb_array_elements(old_players) player
  where player ? 'name';

  select jsonb_agg(
    case
      when not (player ? 'name') then player
      when player ? 'teeTime' then player
      when not (old_by_name ? (player->>'name')) then player
      else player
        || case when (old_by_name -> (player->>'name')) ? 'teeTime'
          then jsonb_build_object('teeTime', (old_by_name -> (player->>'name'))->'teeTime')
          else '{}'::jsonb end
        || case when (old_by_name -> (player->>'name')) ? 'startTee'
          then jsonb_build_object('startTee', (old_by_name -> (player->>'name'))->'startTee')
          else '{}'::jsonb end
        || case when (old_by_name -> (player->>'name')) ? 'roundScore'
          then jsonb_build_object('roundScore', (old_by_name -> (player->>'name'))->'roundScore')
          else '{}'::jsonb end
    end
  )
  into merged
  from jsonb_array_elements(new_players) player;

  return coalesce(merged, new_players);
end;
$$;

create or replace function public.gpp_preserve_tournament_json_before_update()
returns trigger
language plpgsql
as $$
begin
  new.leaderboard_json := public.gpp_preserve_leaderboard_enriched_fields(new.leaderboard_json, old.leaderboard_json);
  new.field_json := public.gpp_preserve_leaderboard_enriched_fields(new.field_json, old.field_json);
  return new;
end;
$$;

drop trigger if exists gpp_preserve_tournament_json_before_update on public.gpp_tournaments;
create trigger gpp_preserve_tournament_json_before_update
before update of leaderboard_json, field_json on public.gpp_tournaments
for each row
execute function public.gpp_preserve_tournament_json_before_update();
