-- Roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles: users see their own roles; admins see all
CREATE POLICY "users see own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to SELECT all evaluations / time_segments / responsibles / equipments
CREATE POLICY "admins view all evaluations"
ON public.evaluations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins view all time_segments"
ON public.time_segments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins view all responsibles"
ON public.responsibles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins view all equipments"
ON public.equipments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read any signature object
CREATE POLICY "admins read signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures' AND public.has_role(auth.uid(), 'admin'));