insert into public.ingestion_targets (source_id,target_key,enabled,pullback_start,pullback_end,config)
values
('itf_rules','itf_rules_current',true,(current_date-interval '3 years')::date,current_date,jsonb_build_object('url','https://www.itftennis.com/en/about-us/governance/rules-and-regulations/','kind','rules_context')),
('atp_rules','atp_rules_current',true,(current_date-interval '3 years')::date,current_date,jsonb_build_object('url','https://www.atptour.com/','kind','rules_context')),
('wta_rules','wta_rules_current',true,(current_date-interval '3 years')::date,current_date,jsonb_build_object('url','https://www.wtatennis.com/','kind','rules_context'))
on conflict (source_id,target_key) do update set enabled=excluded.enabled,pullback_start=excluded.pullback_start,pullback_end=excluded.pullback_end,config=excluded.config,updated_at=now();
