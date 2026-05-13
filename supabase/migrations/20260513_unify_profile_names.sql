-- Normalize Golf Pools Pro profile names to one display_name field.
-- New signups should provide one Name field, but older auth metadata may have
-- first_name / last_name. Combine those into display_name/full_name and make
-- the signup trigger tolerant of old metadata shapes.

CREATE OR REPLACE FUNCTION public.gpp_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  combined_name text;
BEGIN
  combined_name := btrim(concat_ws(' ',
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', '')
  ));

  INSERT INTO public.gpp_profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(combined_name, ''),
      split_part(NEW.email, '@', 1)
    ),
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

WITH combined_users AS (
  SELECT
    id,
    email,
    btrim(concat_ws(' ',
      NULLIF(raw_user_meta_data->>'first_name', ''),
      NULLIF(raw_user_meta_data->>'last_name', '')
    )) AS combined_name
  FROM auth.users
  WHERE NULLIF(raw_user_meta_data->>'first_name', '') IS NOT NULL
     OR NULLIF(raw_user_meta_data->>'last_name', '') IS NOT NULL
), profile_updates AS (
  UPDATE public.gpp_profiles p
  SET
    display_name = cu.combined_name,
    updated_at = now()
  FROM combined_users cu
  WHERE p.id = cu.id
    AND cu.combined_name <> ''
    AND (
      NULLIF(p.display_name, '') IS NULL
      OR p.display_name = split_part(cu.email, '@', 1)
      OR p.display_name = cu.combined_name
    )
  RETURNING p.id
)
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'display_name', cu.combined_name,
    'full_name', cu.combined_name
  )
FROM combined_users cu
WHERE u.id = cu.id
  AND cu.combined_name <> '';
