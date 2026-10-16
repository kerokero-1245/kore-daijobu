-- 表・制約・返信のトリガー・招待の関数・RLS を 1 本で作る。アプリの鍵は端末に入るので、守りは DB に置く。
-- status は列の grant から外し、返信の挿入トリガーだけが変える（「返信あり・waiting」を作れなくする）。
-- 招待は表を見せず security definer の関数だけで扱い、補助関数は Data API に出ない private に置く。

create schema if not exists private;

-- ============================================================
-- 表
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  display_name text not null check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.profiles (id) on delete cascade,
  parent_id uuid references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  constraint pairs_active_has_parent check (status <> 'active' or parent_id is not null),
  constraint pairs_parent_is_not_child check (parent_id is null or parent_id <> child_id)
);
create unique index pairs_parent_id_key on public.pairs (parent_id) where parent_id is not null;

create table public.pair_invites (
  code text primary key check (code ~ '^[0-9]{6}$'),
  pair_id uuid not null references public.pairs (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pair_invites_used_together check ((used_at is null) = (used_by is null))
);
create index pair_invites_pair_id_idx on public.pair_invites (pair_id);

create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index invite_attempts_user_id_created_at_idx on public.invite_attempts (user_id, created_at);

create table public.consultations (
  id uuid primary key,
  pair_id uuid not null references public.pairs (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  category text not null
    check (category in ('money', 'refund', 'construction', 'impersonation', 'other')),
  photo_path text,
  status text not null default 'waiting' check (status in ('waiting', 'answered')),
  parent_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consultations_seen_after_answer check (parent_seen_at is null or status = 'answered')
);
create index consultations_pair_id_created_at_idx on public.consultations (pair_id, created_at desc);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations (id) on delete cascade,
  replied_by uuid not null references public.profiles (id) on delete cascade,
  verdict text not null check (verdict in ('danger', 'safe', 'unsure')),
  message text not null check (char_length(btrim(message)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

create table public.push_log (
  id bigint generated always as identity primary key,
  event text not null,
  ticket_id text,
  status text,
  error text,
  created_at timestamptz not null default now()
);
create index push_log_created_at_idx on public.push_log (created_at);

-- ============================================================
-- 返信が入ったら同じトランザクションで相談を answered にする
-- ============================================================

create function private.on_reply_inserted() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.consultations
     set status = 'answered'
   where id = new.consultation_id and status = 'waiting';
  if not found then
    raise exception 'consultation % is not waiting', new.consultation_id
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger on_reply_inserted
  after insert on public.replies
  for each row execute function private.on_reply_inserted();

-- ============================================================
-- RLS の補助（private。pairs の RLS を通さずに当事者を判定する）
-- ============================================================

create function private.my_role_in(p uuid) returns text
  language sql stable security definer set search_path = '' as $$
  select case when parent_id = (select auth.uid()) then 'parent'
              when child_id  = (select auth.uid()) then 'child' end
  from public.pairs where id = p and status = 'active' $$;

create function private.my_pair_ids() returns setof uuid
  language sql stable security definer set search_path = '' as $$
  select id from public.pairs
  where status = 'active' and (select auth.uid()) in (parent_id, child_id) $$;

-- ============================================================
-- 招待（子が発行し、親の端末で引き換える）
-- ============================================================

-- 子が自分の pending のペアに 6 桁の招待を出す。同じペアの古い未使用コードは消す。
create function public.create_invite() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  new_code text;
  exp timestamptz := now() + interval '10 minutes';
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select p.id into pid from public.pairs p
   where p.child_id = uid and p.status = 'pending'
   for update;
  if pid is null then
    raise exception 'no pending pair' using errcode = 'P0001';
  end if;

  delete from public.pair_invites i where i.pair_id = pid and i.used_at is null;

  -- gen_random_uuid は強い乱数で作られる。先頭 32 bit を 6 桁に落とす（偏りは 1e6 / 2^32 程度）。
  for attempt in 1..20 loop
    new_code := lpad(
      (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000)::text,
      6, '0');
    insert into public.pair_invites (code, pair_id, expires_at)
    values (new_code, pid, exp)
    on conflict do nothing;
    if found then
      return jsonb_build_object('code', new_code, 'expires_at', exp);
    end if;
  end loop;
  raise exception 'could not allocate invite code' using errcode = 'P0001';
end $$;

-- 親の端末で招待を引き換える。失敗も例外にせず理由を返す（試行の記録を巻き戻さないため）。
-- reason: ok / too_many_attempts / invalid / expired / used / not_parent / already_paired
create function public.redeem_invite(code text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.pair_invites%rowtype;
  my_role text;
  fails int;
  reason text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- 同じ利用者の同時の引き換えを 1 本ずつにし、回数の数え漏れを防ぐ。
  perform pg_advisory_xact_lock(hashtext('redeem_invite:' || uid::text));

  select count(*) into fails from public.invite_attempts a
   where a.user_id = uid and not a.ok and a.created_at > now() - interval '10 minutes';
  if fails >= 5 then
    insert into public.invite_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select i.* into inv from public.pair_invites i
   where i.code = redeem_invite.code
   for update;

  select pr.role into my_role from public.profiles pr where pr.id = uid;

  if inv.code is null then
    reason := 'invalid';
  elsif inv.used_at is not null then
    reason := 'used';
  elsif inv.expires_at <= now() then
    reason := 'expired';
  elsif my_role is distinct from 'parent' then
    reason := 'not_parent';
  elsif exists (select 1 from public.pairs p where p.parent_id = uid) then
    reason := 'already_paired';
  else
    update public.pairs p set parent_id = uid, status = 'active'
     where p.id = inv.pair_id and p.status = 'pending';
    if not found then
      reason := 'already_paired';
    end if;
  end if;

  if reason is not null then
    insert into public.invite_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('ok', false, 'reason', reason);
  end if;

  update public.pair_invites i set used_at = now(), used_by = uid where i.code = inv.code;
  insert into public.invite_attempts (user_id, ok) values (uid, true);
  return jsonb_build_object('ok', true, 'reason', 'ok', 'pair_id', inv.pair_id);
end $$;

-- ============================================================
-- RLS と grant（revoke all → 列単位の grant → policy）
-- ============================================================

alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.consultations enable row level security;
alter table public.replies enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 関数は既定で PUBLIC が実行できるので、明示して絞る。
revoke all on schema private from public;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.my_role_in(uuid) to authenticated;
grant execute on function private.my_pair_ids() to authenticated;

revoke execute on function public.create_invite() from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- profiles: 自分の行を作り、名前だけ直せる。読めるのは自分とペアの相手。
grant select, insert, update (display_name) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (select 1 from public.pairs p
    where p.id in (select private.my_pair_ids()) and profiles.id in (p.parent_id, p.child_id)));
create policy profiles_write on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_rename on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- pairs: 子が pending で作る。active にするのは redeem_invite だけ。
grant select, insert on public.pairs to authenticated;
create policy pairs_read on public.pairs for select to authenticated
  using ((select auth.uid()) in (parent_id, child_id));
create policy pairs_open on public.pairs for insert to authenticated
  with check (child_id = (select auth.uid()) and parent_id is null and status = 'pending');

-- consultations: 親が作り、親が答えを開いた時刻だけ書ける。status は grant しない。
grant select, insert (id, pair_id, created_by, category) on public.consultations to authenticated;
grant update (parent_seen_at) on public.consultations to authenticated;
create policy cons_read on public.consultations for select to authenticated
  using (pair_id in (select private.my_pair_ids()));
create policy cons_ask on public.consultations for insert to authenticated
  with check (created_by = (select auth.uid()) and private.my_role_in(pair_id) = 'parent');
create policy cons_seen on public.consultations for update to authenticated
  using (private.my_role_in(pair_id) = 'parent' and status = 'answered')
  with check (private.my_role_in(pair_id) = 'parent');

-- replies: 子が返事待ちの相談に 1 回だけ返す。
grant select, insert (consultation_id, replied_by, verdict, message) on public.replies to authenticated;
create policy replies_read on public.replies for select to authenticated
  using (consultation_id in (select id from public.consultations));
create policy replies_answer on public.replies for insert to authenticated
  with check (replied_by = (select auth.uid()) and exists (select 1 from public.consultations c
    where c.id = consultation_id and c.status = 'waiting' and private.my_role_in(c.pair_id) = 'child'));

-- push_tokens: 自分の行だけ。
grant select, insert, update, delete on public.push_tokens to authenticated;
create policy tokens_own on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- pair_invites / invite_attempts / push_log は grant もポリシーも作らない（関数と service role だけが触る）。
