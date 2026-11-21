-- 人狼将棋 v5：日曜限定ガチャ(新キャラ8体)。supabase-v2・v3・v4 のあとに SQL Editor で実行する(何度実行しても大丈夫)
-- 1) 新キャラ8体を景品に追加(日曜限定:LR 魔女・キューピッド、SSR 探偵・ボディーガード・忍者・狂人・墓守・狼少年)
-- 2) ガチャの抽選:SSRは月〜土が基本の4体、日曜は日曜限定の6体。LRは曜日のキャラ
-- 3) アチーブメント「新キャラを全部集める」を16体に
create or replace function public.jinro_banner() returns text language sql stable as $$
  select case when extract(isodow from (now() at time zone 'Asia/Tokyo'))::int in (1,3,6) then 'A'
              when extract(isodow from (now() at time zone 'Asia/Tokyo'))::int in (2,4,5) then 'B' else 'S' end
$$;
create or replace function public.jinro_gacha(p_uid text, p_secret text, p_count int, p_pick text default null) returns json
language plpgsql security definer set search_path = public as $$
declare cost int; c int; tk int; i int; rc int; r float; rar text; it text; got_high boolean := false; ban text := jinro_banner();
  out_arr json[] := '{}'; fresh boolean; refund int; token int; total_refund int := 0; total_token int := 0;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_count = 1 then cost := 100; elsif p_count = 10 then cost := 900; else raise exception 'count'; end if;
  select coins into c from jinro_wallets where uid = p_uid for update;
  if c < cost then raise exception 'coins'; end if;
  update jinro_wallets set coins = coins - cost where uid = p_uid;
  for i in 1..p_count loop
    if p_count = 10 and i = 10 and not got_high then
      r := random() * 12;  rar := case when r < 0.5 then 'LR' when r < 3 then 'SSR' else 'SR' end;  -- 10連はSR以上を1つ確定
    else
      r := random() * 100; rar := case when r < 0.5 then 'LR' when r < 3 then 'SSR' when r < 12 then 'SR' when r < 40 then 'R' else 'N' end;
    end if;
    if rar in ('SR','SSR','LR') then got_high := true; end if;
    if rar = 'LR' then                                               -- LRは曜日のキャラ
      select id into it from jinro_items where rarity = 'LR' and gacha and banner = ban order by random() limit 1;
    elsif rar = 'SSR' then                                           -- SSRは月〜土が基本の4体、日曜は日曜限定の6体
      select id into it from jinro_items where rarity = 'SSR' and gacha and (case when ban = 'S' then banner = 'S' else banner is null end) order by random() limit 1;
    else
      select id into it from jinro_items where rarity = rar and gacha order by random() limit 1;
    end if;
    insert into jinro_inventory(uid, item) values (p_uid, it) on conflict do nothing;
    get diagnostics rc = row_count; fresh := rc > 0;
    -- 被ったら:N 1・R 5・SR 10コイン。キャラ(SSR/LR)は特別コイン(SSR 1枚・LR 2枚)
    refund := case when fresh then 0 else case rar when 'N' then 1 when 'R' then 5 when 'SR' then 10 else 0 end end;
    token := case when fresh then 0 else case rar when 'SSR' then 1 when 'LR' then 2 else 0 end end;
    total_refund := total_refund + refund; total_token := total_token + token;
    out_arr := out_arr || json_build_object('item', it, 'rarity', rar, 'dup', not fresh, 'refund', refund, 'token', token);
  end loop;
  update jinro_wallets set coins = coins + total_refund, tokens = tokens + total_token where uid = p_uid returning coins, tokens into c, tk;
  return json_build_object('coins', c, 'tokens', tk, 'banner', ban, 'results', array_to_json(out_arr));
end $$;
grant execute on function public.jinro_gacha(text,text,int,text) to anon, authenticated;

-- ========== ガチャの景品一覧とアチーブメント(catalog.js から生成) ==========
insert into public.jinro_items(id, kind, rarity, gacha, banner) values
  ('c_medium', 'char', 'SSR', true, null),
  ('c_tough', 'char', 'SSR', true, null),
  ('c_nekomata', 'char', 'SSR', true, null),
  ('c_teru', 'char', 'SSR', true, null),
  ('c_fox', 'char', 'LR', true, 'A'),
  ('c_thief', 'char', 'LR', true, 'A'),
  ('c_vampire', 'char', 'LR', true, 'B'),
  ('c_cursed', 'char', 'LR', true, 'B'),
  ('c_witch', 'char', 'LR', true, 'S'),
  ('c_cupid', 'char', 'LR', true, 'S'),
  ('c_detective', 'char', 'SSR', true, 'S'),
  ('c_bodyguard', 'char', 'SSR', true, 'S'),
  ('c_ninja', 'char', 'SSR', true, 'S'),
  ('c_madman', 'char', 'SSR', true, 'S'),
  ('c_gravekeeper', 'char', 'SSR', true, 'S'),
  ('c_wolfboy', 'char', 'SSR', true, 'S'),
  ('k_pop', 'skin', 'SR', true, null),
  ('k_neon', 'skin', 'SR', true, null),
  ('k_gold', 'skin', 'SR', true, null),
  ('f_gold', 'frame', 'SR', true, null),
  ('f_purple', 'frame', 'SR', true, null),
  ('f_pink', 'frame', 'SR', true, null),
  ('w_gold', 'wolf', 'SR', true, null),
  ('w_blue', 'wolf', 'SR', true, null),
  ('b_moon', 'back', 'SR', true, null),
  ('b_star', 'back', 'SR', true, null),
  ('b_paw', 'back', 'SR', true, null),
  ('t_legend', 'title', 'SR', true, null),
  ('t_lord', 'title', 'SR', true, null),
  ('t_unbeaten', 'title', 'SR', true, null),
  ('s_all', 'stamp', 'SR', true, null),
  ('s_night', 'stamp', 'SR', true, null),
  ('k_mint', 'skin', 'R', true, null),
  ('k_sakura', 'skin', 'R', true, null),
  ('k_sky', 'skin', 'R', true, null),
  ('k_night', 'skin', 'R', true, null),
  ('f_red', 'frame', 'R', true, null),
  ('f_blue', 'frame', 'R', true, null),
  ('f_green', 'frame', 'R', true, null),
  ('w_black', 'wolf', 'R', true, null),
  ('w_white', 'wolf', 'R', true, null),
  ('b_check', 'back', 'R', true, null),
  ('t_hunter', 'title', 'R', true, null),
  ('t_guard', 'title', 'R', true, null),
  ('t_doubt', 'title', 'R', true, null),
  ('t_counter', 'title', 'R', true, null),
  ('t_bluff', 'title', 'R', true, null),
  ('s_read', 'stamp', 'R', true, null),
  ('s_trap', 'stamp', 'R', true, null),
  ('s_give', 'stamp', 'R', true, null),
  ('s_fast', 'stamp', 'R', true, null),
  ('t_novice', 'title', 'N', true, null),
  ('t_fan', 'title', 'N', true, null),
  ('t_owl', 'title', 'N', true, null),
  ('t_rookie', 'title', 'N', true, null),
  ('s_wolf', 'stamp', 'N', true, null),
  ('s_no', 'stamp', 'N', true, null),
  ('s_more', 'stamp', 'N', true, null),
  ('s_fufu', 'stamp', 'N', true, null),
  ('s_gg', 'stamp', 'N', true, null),
  ('s_oops', 'stamp', 'N', true, null),
  ('t_win10', 'title', 'R', false, null),
  ('t_win25', 'title', 'SR', false, null),
  ('t_win50', 'title', 'SSR', false, null),
  ('t_win100', 'title', 'LR', false, null),
  ('t_ssrall', 'title', 'SSR', false, null),
  ('t_charall', 'title', 'LR', false, null)
on conflict (id) do update set kind = excluded.kind, rarity = excluded.rarity, gacha = excluded.gacha, banner = excluded.banner;
delete from public.jinro_items where id not in ('c_medium', 'c_tough', 'c_nekomata', 'c_teru', 'c_fox', 'c_thief', 'c_vampire', 'c_cursed', 'c_witch', 'c_cupid', 'c_detective', 'c_bodyguard', 'c_ninja', 'c_madman', 'c_gravekeeper', 'c_wolfboy', 'k_pop', 'k_neon', 'k_gold', 'f_gold', 'f_purple', 'f_pink', 'w_gold', 'w_blue', 'b_moon', 'b_star', 'b_paw', 't_legend', 't_lord', 't_unbeaten', 's_all', 's_night', 'k_mint', 'k_sakura', 'k_sky', 'k_night', 'f_red', 'f_blue', 'f_green', 'w_black', 'w_white', 'b_check', 't_hunter', 't_guard', 't_doubt', 't_counter', 't_bluff', 's_read', 's_trap', 's_give', 's_fast', 't_novice', 't_fan', 't_owl', 't_rookie', 's_wolf', 's_no', 's_more', 's_fufu', 's_gg', 's_oops', 't_win10', 't_win25', 't_win50', 't_win100', 't_ssrall', 't_charall');
insert into public.jinro_achievements(id, stat, goal, coins, tokens, item) values
  ('a_first', 'wins', 1, 100, 0, null),
  ('a_games10', 'games', 10, 200, 0, null),
  ('a_friend', 'friends', 1, 100, 0, null),
  ('a_win10', 'wins', 10, 300, 0, 't_win10'),
  ('a_win25', 'wins', 25, 500, 1, 't_win25'),
  ('a_win50', 'wins', 50, 1000, 2, 't_win50'),
  ('a_win100', 'wins', 100, 2000, 5, 't_win100'),
  ('a_ssrall', 'ssr', 4, 1000, 0, 't_ssrall'),
  ('a_charall', 'chars', 16, 3000, 5, 't_charall')
on conflict (id) do update set stat = excluded.stat, goal = excluded.goal, coins = excluded.coins, tokens = excluded.tokens, item = excluded.item;
