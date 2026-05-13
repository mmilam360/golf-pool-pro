create or replace function public.gpp_prevent_pool_unlock()
returns trigger
language plpgsql
as $$
begin
  if old.is_locked is true and new.is_locked is false then
    raise exception 'Pools cannot be unlocked after locking';
  end if;
  return new;
end;
$$;

drop trigger if exists gpp_prevent_pool_unlock_trigger on public.gpp_pools;

create trigger gpp_prevent_pool_unlock_trigger
before update of is_locked on public.gpp_pools
for each row
execute function public.gpp_prevent_pool_unlock();
