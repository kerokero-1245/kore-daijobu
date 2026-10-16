-- Realtime で画面を更新する表を publication に足す（Supabase 固有の publication なので 1 本目と分ける）。
-- replies は足さない。返信はトリガーが consultations を UPDATE するので、その事件で足りる。
-- 乱数は gen_random_uuid（Postgres 13 以降の本体）だけを使い、pgcrypto は要らない。
alter publication supabase_realtime add table public.consultations, public.pairs;
