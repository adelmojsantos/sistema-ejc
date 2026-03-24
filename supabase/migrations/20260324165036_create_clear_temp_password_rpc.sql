create or replace function public.clear_temporary_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set temporary_password = false
  where id = auth.uid();
end;
$$;
