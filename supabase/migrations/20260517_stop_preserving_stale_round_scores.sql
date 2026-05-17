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
      when not (old_by_name ? (player->>'name')) then player
      else player
        || case
          when not (player ? 'teeTime') and (old_by_name -> (player->>'name')) ? 'teeTime'
            then jsonb_build_object('teeTime', (old_by_name -> (player->>'name'))->'teeTime')
          else '{}'::jsonb end
        || case
          when not (player ? 'startTee') and (old_by_name -> (player->>'name')) ? 'startTee'
            then jsonb_build_object('startTee', (old_by_name -> (player->>'name'))->'startTee')
          else '{}'::jsonb end
    end
  )
  into merged
  from jsonb_array_elements(new_players) player;

  return coalesce(merged, new_players);
end;
$$;
