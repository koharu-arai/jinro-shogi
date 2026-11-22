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

-- ================================================================
-- 人狼将棋 v6(その2)：プレイヤーレベル(ランク制度)
-- ・経験値は jinro_wallets.exp に保存し、加算は必ずサーバー側の関数 jinro_add_exp 経由にする
--   (jinro_add_exp は直接呼べないようにしてあり、対戦記録・CPU戦・ストーリーの各RPCの中からだけ呼ばれる)
-- ・相手にも見える表示用に、jinro_players.exp にも同じ値を写す(書き換えは関数経由のみ)
-- ・レベル: Lv1〜99。次のレベルに必要な経験値は 100 + (今のレベル - 1) × 20
-- ・経験値: オンライン 勝ち+50/負け+20、CPU 勝ち やさしい+10/ふつう+20/つよい+30・負け+5、
--   ストーリー 章の初回クリア+100、最終章(ボス)の初回クリアはさらに+200
-- ・レベルアップ報酬: 毎回+50コイン。Lv10/20/30/50/80 ではランク名の称号と枠、特別コイン+1
-- ・王様・人狼の光り方(旧ランク)はプレイヤーレベルに一本化: Lv5でR、15でSR、30でSSR、50でLR(クライアント側で計算)
-- ================================================================

-- ========== 列の追加 ==========
alter table public.jinro_wallets add column if not exists exp int not null default 0;
alter table public.jinro_players add column if not exists exp int not null default 0;
alter table public.jinro_cpu_games add column if not exists result text;
alter table public.jinro_cpu_games add column if not exists exp int not null default 0;

create table if not exists public.jinro_story_clears (   -- ストーリーのクリア記録(初回だけ経験値)
  uid text not null,
  stage text not null,
  created_at timestamptz not null default now(),
  primary key (uid, stage)
);
alter table public.jinro_story_clears enable row level security;

create table if not exists public.jinro_exp_migrations ( -- 過去戦績→経験値の換算を一度だけ行うための記録
  id text primary key,
  done_at timestamptz not null default now()
);

-- ========== 節目報酬の景品(ガチャからは出ない) ==========
insert into public.jinro_items(id, kind, rarity, gacha, banner) values
  ('t_lv10', 'title', 'R',   false, null),
  ('t_lv20', 'title', 'SR',  false, null),
  ('t_lv30', 'title', 'SSR', false, null),
  ('t_lv50', 'title', 'SSR', false, null),
  ('t_lv80', 'title', 'LR',  false, null),
  ('f_lv10', 'frame', 'R',   false, null),
  ('f_lv20', 'frame', 'SR',  false, null),
  ('f_lv30', 'frame', 'SSR', false, null),
  ('f_lv50', 'frame', 'SSR', false, null),
  ('f_lv80', 'frame', 'LR',  false, null)
on conflict (id) do update set kind = excluded.kind, rarity = excluded.rarity, gacha = excluded.gacha, banner = excluded.banner;

-- ========== レベル計算 ==========
-- レベルLに到達するまでの累計経験値: (L-1)*100 + 10*(L-1)*(L-2)
create or replace function public.jinro_level(p_exp int) returns int
language plpgsql immutable as $$
declare l int := 1;
begin
  while l < 99 and p_exp >= l * 100 + 10 * l * (l - 1) loop
    l := l + 1;
  end loop;
  return l;
end $$;

-- ========== 経験値の加算(内部専用) ==========
-- レベルアップ報酬(毎回+50コイン)と節目報酬(称号・枠・特別コイン)をまとめて処理し、結果を json で返す
create or replace function public.jinro_add_exp(p_uid text, p_gain int) returns json
language plpgsql security definer set search_path = public as $$
declare
  w jinro_wallets; before_lv int; after_lv int; coin_gain int := 0; token_gain int := 0;
  milestones int[] := '{}'; m_lv int; m_title text; m_frame text;
begin
  if p_gain is null or p_gain <= 0 then
    select * into w from jinro_wallets where uid = p_uid;
    return json_build_object('exp', coalesce(w.exp, 0), 'level_before', jinro_level(coalesce(w.exp, 0)),
      'level_after', jinro_level(coalesce(w.exp, 0)), 'gain', 0, 'coins_gain', 0, 'milestones', '[]'::json);
  end if;
  insert into jinro_wallets(uid) values (p_uid) on conflict (uid) do nothing;
  select * into w from jinro_wallets where uid = p_uid for update;
  before_lv := jinro_level(w.exp);
  after_lv := jinro_level(w.exp + p_gain);
  coin_gain := 50 * greatest(0, after_lv - before_lv);
  for m_lv, m_title, m_frame in
    select * from (values (10, 't_lv10', 'f_lv10'), (20, 't_lv20', 'f_lv20'), (30, 't_lv30', 'f_lv30'),
                          (50, 't_lv50', 'f_lv50'), (80, 't_lv80', 'f_lv80')) as t(lv, ti, fr)
  loop
    if before_lv < m_lv and after_lv >= m_lv then
      insert into jinro_inventory(uid, item) values (p_uid, m_title), (p_uid, m_frame) on conflict do nothing;
      token_gain := token_gain + 1;
      milestones := milestones || m_lv;
    end if;
  end loop;
  update jinro_wallets set exp = exp + p_gain, coins = coins + coin_gain, tokens = tokens + token_gain
   where uid = p_uid returning * into w;
  update jinro_players set exp = w.exp where uid = p_uid;
  return json_build_object('exp', w.exp, 'level_before', before_lv, 'level_after', after_lv,
    'gain', p_gain, 'coins_gain', coin_gain, 'tokens_gain', token_gain,
    'milestones', (select coalesce(json_agg(x), '[]'::json) from unnest(milestones) as x));
end $$;
-- ブラウザからは直接呼べないようにする(ほかのRPC=所有者権限の関数からだけ呼ばれる)
revoke execute on function public.jinro_add_exp(text, int) from public, anon, authenticated;

-- ========== 状態に経験値を追加 ==========
create or replace function public.jinro_state(p_uid text, p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare w jinro_wallets; pl jinro_players; d date := jinro_today(); res json;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into w from jinro_wallets where uid = p_uid;
  update jinro_players set last_seen = now(),
    friend_code = coalesce(friend_code, jinro_gen_code()) where uid = p_uid;
  select * into pl from jinro_players where uid = p_uid;
  select json_build_object(
    'coins', w.coins, 'tokens', w.tokens, 'streak', w.streak, 'banner', jinro_banner(), 'welcomed', w.welcomed,
    'exp', w.exp, 'level', jinro_level(w.exp),
    'login_claimable', (w.last_login is null or w.last_login < d),
    'name', pl.name, 'title', pl.title, 'avatar', pl.avatar, 'look', coalesce(pl.look, '{}'::jsonb), 'friend_code', pl.friend_code,
    'items', coalesce((select json_agg(item order by created_at) from jinro_inventory where uid = p_uid), '[]'::json),
    'missions', json_build_object(
      'm_play',  (select count(*) from jinro_results where uid = p_uid and (created_at at time zone 'Asia/Tokyo')::date = d),
      'm_win',   (select count(*) from jinro_results where uid = p_uid and win and (created_at at time zone 'Asia/Tokyo')::date = d),
      'm_stamp', (select count(*) from jinro_chat where uid = p_uid and (created_at at time zone 'Asia/Tokyo')::date = d)),
    'claimed', coalesce((select json_agg(mission) from jinro_mission_claims where uid = p_uid and day = d), '[]'::json),
    'stats', jinro_stats(p_uid),
    'ach_claimed', coalesce((select json_agg(ach) from jinro_ach_claims where uid = p_uid), '[]'::json),
    'friends', coalesce((
      select json_agg(json_build_object(
        'uid', o.uid, 'name', p.name, 'title', p.title, 'avatar', p.avatar, 'exp', coalesce(p.exp, 0), 'status', f.status, 'incoming', (f.status = 'pending' and f.requested_by <> p_uid),
        'last_seen', p.last_seen,
        'w', (select count(*) from jinro_results r where r.uid = o.uid and r.win),
        'n', (select count(*) from jinro_results r where r.uid = o.uid)) order by f.status, p.name)
      from jinro_friends f
      cross join lateral (select case when f.a = p_uid then f.b else f.a end as uid) o
      left join jinro_players p on p.uid = o.uid
      where f.a = p_uid or f.b = p_uid), '[]'::json),
    'invites', coalesce((
      select json_agg(json_build_object('id', i.id, 'from', i.from_uid, 'name', p.name, 'code', i.code, 'at', i.created_at) order by i.created_at desc)
      from jinro_invites i left join jinro_players p on p.uid = i.from_uid
      where i.to_uid = p_uid and i.created_at > now() - interval '15 minutes'), '[]'::json)
  ) into res;
  return res;
end $$;

-- ========== オンライン対戦の結果に経験値を追加 ==========
create or replace function public.jinro_record_result(p_uid text, p_secret text, p_code text, p_game_no int) returns json
language plpgsql security definer set search_path = public as $$
declare g jsonb; s int; won boolean; inserted int; ex json;
begin
  perform jinro_auth(p_uid, p_secret);
  select game into g from jinro_rooms where code = p_code;
  select seat into s from jinro_seats where code = p_code and uid = p_uid;
  if g is null or s is null or g->>'phase' <> 'over' or (g->>'startNo')::int <> p_game_no or g->>'winner' is null then raise exception 'state'; end if;
  won := (g->>'winner')::int = s;
  insert into jinro_results(code, game_no, uid, win) values (p_code, p_game_no, p_uid, won)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    ex := jinro_add_exp(p_uid, case when won then 50 else 20 end);
  else
    ex := jinro_add_exp(p_uid, 0);
  end if;
  return json_build_object('win', won, 'exp_gain', (ex->>'gain')::int, 'exp', (ex->>'exp')::int,
    'level_before', (ex->>'level_before')::int, 'level_after', (ex->>'level_after')::int,
    'coins_gain', (ex->>'coins_gain')::int, 'milestones', ex->'milestones');
end $$;

-- ========== CPU戦の経験値(勝ちは既存の jinro_cpu_win の中で、負けは新しい jinro_cpu_lose で) ==========
create or replace function public.jinro_cpu_exp(p_level text) returns int language sql immutable as $$
  select case p_level when 'easy' then 10 when 'normal' then 20 when 'hard' then 30 else 0 end
$$;

create or replace function public.jinro_cpu_win(p_uid text, p_secret text, p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare g jinro_cpu_games; got int; pay int; c int; ex json;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into g from jinro_cpu_games where id = p_game and uid = p_uid for update;
  if not found then raise exception 'notfound'; end if;
  if g.won or g.result is not null then raise exception 'already'; end if;
  if now() - g.started_at < interval '20 seconds' then raise exception 'fast'; end if;
  select coalesce(sum(reward), 0) into got from jinro_cpu_games where uid = p_uid and day = jinro_today();
  pay := greatest(0, least(jinro_cpu_reward(g.level), 50 - got));
  update jinro_cpu_games set won = true, result = 'win', reward = pay, exp = jinro_cpu_exp(g.level) where id = p_game;
  insert into jinro_wallets(uid) values (p_uid) on conflict do nothing;
  update jinro_wallets set coins = coins + pay where uid = p_uid returning coins into c;
  ex := jinro_add_exp(p_uid, jinro_cpu_exp(g.level));
  return json_build_object('coins', c, 'reward', pay, 'today', got + pay, 'cap', 50,
    'exp_gain', (ex->>'gain')::int, 'exp', (ex->>'exp')::int,
    'level_before', (ex->>'level_before')::int, 'level_after', (ex->>'level_after')::int,
    'coins_gain', (ex->>'coins_gain')::int, 'milestones', ex->'milestones');
end $$;

create or replace function public.jinro_cpu_lose(p_uid text, p_secret text, p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare g jinro_cpu_games; ex json;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into g from jinro_cpu_games where id = p_game and uid = p_uid for update;
  if not found then raise exception 'notfound'; end if;
  if g.result is not null then raise exception 'already'; end if;
  if now() - g.started_at < interval '20 seconds' then raise exception 'fast'; end if;
  update jinro_cpu_games set result = 'lose', exp = 5 where id = p_game;
  ex := jinro_add_exp(p_uid, 5);
  return json_build_object('exp_gain', (ex->>'gain')::int, 'exp', (ex->>'exp')::int,
    'level_before', (ex->>'level_before')::int, 'level_after', (ex->>'level_after')::int,
    'coins_gain', (ex->>'coins_gain')::int, 'milestones', ex->'milestones');
end $$;
grant execute on function public.jinro_cpu_lose(text, text, uuid) to anon, authenticated;

-- ========== ストーリーのクリア報酬 ==========
-- stage: 'ch1' / 'ch2' / 'ch3'。初回クリアで +100、最終章(ch3)=章ボスとして さらに +200
create or replace function public.jinro_story_clear(p_uid text, p_secret text, p_stage text) returns json
language plpgsql security definer set search_path = public as $$
declare inserted int; gain int := 0; ex json;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_stage not in ('ch1', 'ch2', 'ch3') then raise exception 'stage'; end if;
  insert into jinro_story_clears(uid, stage) values (p_uid, p_stage) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    gain := 100 + (case when p_stage = 'ch3' then 200 else 0 end);
    ex := jinro_add_exp(p_uid, gain);
  else
    ex := jinro_add_exp(p_uid, 0);
  end if;
  return json_build_object('stage', p_stage, 'boss', p_stage = 'ch3', 'first', inserted > 0,
    'exp_gain', (ex->>'gain')::int, 'exp', (ex->>'exp')::int,
    'level_before', (ex->>'level_before')::int, 'level_after', (ex->>'level_after')::int,
    'coins_gain', (ex->>'coins_gain')::int, 'milestones', ex->'milestones');
end $$;
grant execute on function public.jinro_story_clear(text, text, text) to anon, authenticated;

-- ========== 過去のオンライン戦績を、最初に一度だけ経験値に換算する ==========
do $$
declare r record;
begin
  if not exists (select 1 from jinro_exp_migrations where id = 'online_results_v1') then
    for r in
      select uid, count(*) filter (where win) as wins, count(*) filter (where not win) as losses
      from jinro_results group by uid
    loop
      perform jinro_add_exp(r.uid, r.wins * 50 + r.losses * 20);
    end loop;
    insert into jinro_exp_migrations(id) values ('online_results_v1');
  end if;
end $$;

-- 確認用
select uid, name, exp from public.jinro_players where exp > 0 order by exp desc limit 10;
