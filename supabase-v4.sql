-- 人狼将棋 v4：キャラ素材 chara3 用。supabase.sql・v2・v3 のあとに SQL Editor で実行する（何度実行しても大丈夫）
-- 1) アイコンの見た目（顔イラスト・金フレーム・豪華版）をほかの人にも見せる
-- 2) 対戦中のリアクション道具（r_<キャラ>）を送れるようにする
-- 解放状態は各端末に保存しているため、ここでは「見た目の種類」だけを受け付ける（コインや持ち物には影響しない）

create or replace function public.jinro_set_avatar2(p_uid text, p_secret text, p_char text, p_bg int, p_style text) returns json
language plpgsql security definer set search_path = public as $$
declare v_style text := coalesce(p_style, 'svg');
begin
  perform jinro_auth(p_uid, p_secret);
  if p_bg is null or p_bg < 0 or p_bg > 7 then raise exception 'avatar'; end if;
  if p_char not in ('king','wolf','villager','seer','hunter','knight')
     and not exists (select 1 from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and t.kind = 'char' and t.id = 'c_' || p_char) then
    raise exception 'notowned';
  end if;
  if v_style not in ('svg','img','gold','lux') then v_style := 'svg'; end if;
  if v_style = 'lux' and p_char not in ('fox','thief','vampire','cursed') then v_style := 'gold'; end if;
  if v_style = 'gold' and p_char in ('fox','thief','vampire','cursed') then v_style := 'img'; end if;
  update jinro_players set avatar = case when v_style = 'svg' then jsonb_build_object('c', p_char, 'bg', p_bg)
                                         else jsonb_build_object('c', p_char, 'bg', p_bg, 's', v_style) end
   where uid = p_uid;
  return json_build_object('ok', true);
end $$;
grant execute on function public.jinro_set_avatar2(text,text,text,int,text) to anon, authenticated;

create or replace function public.jinro_send_stamp(p_uid text, p_secret text, p_code text, p_item text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jinro_auth(p_uid, p_secret);
  if not exists (select 1 from jinro_seats where code = p_code and uid = p_uid) then raise exception 'seat'; end if;
  if p_item not in ('s_hello','s_nice','s_thanks','s_hmm')
     and p_item !~ '^r_(king|wolf|villager|seer|hunter|knight|medium|tough|nekomata|teru|fox|thief|vampire|cursed)$'
     and not exists (select 1 from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and i.item = p_item and t.kind = 'stamp') then
    raise exception 'notowned';
  end if;
  if exists (select 1 from jinro_chat where uid = p_uid and created_at > now() - interval '2 seconds') then raise exception 'slow'; end if;
  insert into jinro_chat(code, uid, item) values (p_code, p_uid, p_item);
  return json_build_object('ok', true);
end $$;
