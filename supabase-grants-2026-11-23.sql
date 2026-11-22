-- 人狼将棋 個別配布(2026-11-23・本人の指示)
-- けんた(e1328a3d-e9fa-471b-90ed-6b070b3e8349): 10,000コイン + 虹色称号「稀代のポンコツ」(t_ponkotsu)
-- いけだ=ゆうき(a9205226-7f59-4d24-8a97-99e8801f8987): 虹色称号「前田の彼氏」(t_maeda_bf)
-- ※コイン加算は冪等ではないので、このファイルは一度だけ実行すること。

insert into public.jinro_items(id, kind, rarity, gacha, banner) values
  ('t_ponkotsu', 'title', 'LR', false, null),
  ('t_maeda_bf', 'title', 'LR', false, null)
on conflict (id) do nothing;

insert into public.jinro_inventory(uid, item) values
  ('e1328a3d-e9fa-471b-90ed-6b070b3e8349', 't_ponkotsu'),
  ('a9205226-7f59-4d24-8a97-99e8801f8987', 't_maeda_bf')
on conflict do nothing;

update public.jinro_players set title = 't_ponkotsu'
  where uid = 'e1328a3d-e9fa-471b-90ed-6b070b3e8349';
update public.jinro_players set title = 't_maeda_bf'
  where uid = 'a9205226-7f59-4d24-8a97-99e8801f8987';

update public.jinro_wallets set coins = coins + 10000
  where uid = 'e1328a3d-e9fa-471b-90ed-6b070b3e8349';

-- 確認用
select p.uid, p.name, p.title, w.coins from public.jinro_players p
  join public.jinro_wallets w on w.uid = p.uid
  where p.uid in ('e1328a3d-e9fa-471b-90ed-6b070b3e8349', 'a9205226-7f59-4d24-8a97-99e8801f8987');
