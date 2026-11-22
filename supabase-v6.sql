-- 人狼将棋 v6：特別称号「グランドマスター」(光る黒・こはる専用)。supabase-v5 のあとに SQL Editor で実行する(何度実行しても大丈夫)
-- 注意：v2〜v5 を再実行した場合は、そのあとにこの v6 を再実行すること(旧ファイルの景品一覧に無いため消える)

-- 1) 景品に追加(ガチャからは出ない)
insert into public.jinro_items(id, kind, rarity, gacha, banner) values
  ('t_grandmaster', 'title', 'LR', false, null)
on conflict (id) do update set kind = excluded.kind, rarity = excluded.rarity, gacha = excluded.gacha, banner = excluded.banner;

-- 2) こはる本命アカウント(対戦実績のある方。もう1件の同名アカウントには付けない)に所持させて、そのまま装備する
insert into public.jinro_inventory(uid, item) values
  ('90538234-ddd2-40f8-be26-37a1357660a2', 't_grandmaster')
on conflict do nothing;

update public.jinro_players set title = 't_grandmaster'
where uid = '90538234-ddd2-40f8-be26-37a1357660a2' and name = 'こはる';

-- 3) 確認用(実行後に結果が表示される)
select uid, name, title from public.jinro_players where uid = '90538234-ddd2-40f8-be26-37a1357660a2';
select uid, item from public.jinro_inventory where uid = '90538234-ddd2-40f8-be26-37a1357660a2' and item = 't_grandmaster';
