-- 「役割を選び直す」（サインアウトして新しい匿名ユーザーで役割の選択へ）の前に、自分が子の pending のペアを消す関数。
-- 消さずにサインアウトすると、前に出した番号が期限（10 分）まで使え、それを入れた親は、どの端末にもいない
-- 匿名ユーザーとつながってしまう（相談は誰にも届かず、本物の子の番号は already_paired で断られる）。
-- pair_invites は pair_id の on delete cascade で一緒に消えるので、前の番号は invalid になる。
-- 消すのは自分が child の pending のペアだけ。つながった（active）ペア・他人のペアは消さない。該当が無ければ何もしない。
-- pairs の delete は grant もポリシーも作らない（1 本目のまま）。消せるのはこの関数だけ。

create function public.cancel_pending_pair() returns void
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.pairs p where p.child_id = uid and p.status = 'pending';
end $$;

revoke execute on function public.cancel_pending_pair() from public, anon;
grant execute on function public.cancel_pending_pair() to authenticated;
