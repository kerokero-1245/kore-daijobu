-- 端末の通知のトークンを、いまサインインしている利用者のものとして登録する関数。
-- push_tokens は token が主キーで、tokens_own（自分の行だけ）のポリシーでは、前の利用者の行が残っていると
-- 同じ端末の新しい利用者の upsert が RLS で断られ、その端末は以後ずっと通知を受けない
-- （サインアウトの前の削除は、保存したセッションが読めないときや通信の失敗で飛ぶことがある）。
-- トークンを持っていること＝その端末を使っていること、とみなし、持ち主を移して disabled_at を null に戻す。
-- 表の grant と tokens_own は 1 本目のまま変えない（直接の読み書きは自分の行だけ）。

create function public.register_push_token(p_token text) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'register_push_token: サインインしていません';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'register_push_token: トークンが空です';
  end if;
  insert into public.push_tokens (token, user_id, disabled_at)
    values (p_token, me, null)
    on conflict (token) do update set user_id = me, disabled_at = null;
end $$;

revoke execute on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
