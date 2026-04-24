-- Equipments: todos os autenticados podem ver
DROP POLICY IF EXISTS "eq own select" ON public.equipments;
CREATE POLICY "eq authenticated select"
  ON public.equipments FOR SELECT
  TO authenticated
  USING (true);

-- Responsibles: todos os autenticados podem ver
DROP POLICY IF EXISTS "rs own select" ON public.responsibles;
CREATE POLICY "rs authenticated select"
  ON public.responsibles FOR SELECT
  TO authenticated
  USING (true);