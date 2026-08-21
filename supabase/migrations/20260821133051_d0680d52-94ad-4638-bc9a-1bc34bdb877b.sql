CREATE TABLE public.audit_stage_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid),
  audit_run_id uuid NOT NULL REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  stage text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  done_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_run_id, stage)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_stage_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_stage_runs TO anon;
GRANT ALL ON public.audit_stage_runs TO service_role;

ALTER TABLE public.audit_stage_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "single user open access" ON public.audit_stage_runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER audit_stage_runs_updated BEFORE UPDATE ON public.audit_stage_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();