-- Fix signup failures from auth.users trigger by making the profile insert schema-safe.
-- Supabase Auth may execute triggers with a restricted search_path, so unqualified
-- table names can fail with "Database error saving new user".

CREATE OR REPLACE FUNCTION public.gpp_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.gpp_profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$$;
