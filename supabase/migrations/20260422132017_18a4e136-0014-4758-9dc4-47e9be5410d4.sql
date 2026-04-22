
-- Storage policies for signatures bucket (per-user folder)
CREATE POLICY "signatures own select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures own insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures own update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures own delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Equipments table
CREATE TABLE public.equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  brand text,
  serial_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eq own select" ON public.equipments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "eq own insert" ON public.equipments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "eq own update" ON public.equipments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "eq own delete" ON public.equipments FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER equipments_touch BEFORE UPDATE ON public.equipments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Responsibles table (technicians) with stored signature path
CREATE TABLE public.responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  registry text,
  signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.responsibles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs own select" ON public.responsibles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rs own insert" ON public.responsibles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rs own update" ON public.responsibles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "rs own delete" ON public.responsibles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER responsibles_touch BEFORE UPDATE ON public.responsibles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
