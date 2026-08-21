INSERT INTO public.calibration_buckets (user_id, calibration_version_id, bucket_code, bucket_label, wp_min, wp_max, wins, graded, small_sample)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, '327bfff5-c994-4f1f-b65f-dc1ba812d282'::uuid, b.code, b.label, b.lo, b.hi, b.wins, b.graded, b.graded < 20
FROM (VALUES
  ('B50_55','50-55%',50,55,17,31),
  ('B55_60','55-60%',55,60,20,34),
  ('B60_65','60-65%',60,65,17,26),
  ('B65_70','65-70%',65,70,18,25),
  ('B70_75','70-75%',70,75,20,26),
  ('B75_80','75-80%',75,80,16,20),
  ('B80_85','80-85%',80,85,13,15),
  ('B85_100','85-100%',85,100,6,6)
) AS b(code,label,lo,hi,wins,graded)
WHERE NOT EXISTS (
  SELECT 1 FROM public.calibration_buckets cb
  WHERE cb.calibration_version_id = '327bfff5-c994-4f1f-b65f-dc1ba812d282'::uuid AND cb.bucket_code = b.code
);