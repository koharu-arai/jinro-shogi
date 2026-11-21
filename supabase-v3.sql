-- 人狼将棋 v3:CPU対戦のコイン報酬
-- supabase-v2.sql のあとに実行する。勝ったときのコインは必ずこの関数を通して受け取る。
-- 報酬:やさしい 3・ふつう 5・つよい 10 コイン。1日に受け取れるのは合計50コインまで。

create table if not exists public.jinro_cpu_games (     -- CPU対戦の記録(誰からも直接は読めない)
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  level text not null check (level in ('easy','normal','hard')),
  started_at timestamptz not null default now(),
  won boolean not null default false,
  reward int not null default 0,
  day date not null default jinro_today()
);
create index if not exists jinro_cpu_games_uid_day on public.jinro_cpu_games(uid, day);
alter table public.jinro_cpu_games enable row level security;

create or replace function public.jinro_cpu_reward(p_level text) returns int language sql immutable as $$
  select case p_level when 'easy' then 3 when 'normal' then 5 when 'hard' then 10 else 0 end
$$;

-- 対局開始:記録を作って、今日すでに受け取った分を返す
create or replace function public.jinro_cpu_start(p_uid text, p_secret text, p_level text) returns json
language plpgsql security definer set search_path = public as $$
declare gid uuid; got int;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_level not in ('easy','normal','hard') then raise exception 'level'; end if;
  insert into jinro_cpu_games(uid, level) values (p_uid, p_level) returning id into gid;
  select coalesce(sum(reward), 0) into got from jinro_cpu_games where uid = p_uid and day = jinro_today();
  return json_build_object('game', gid, 'today', got, 'cap', 50, 'reward', jinro_cpu_reward(p_level));
end $$;

-- 勝ったとき:開始から20秒以上・未受け取り・1日50コインまで
create or replace function public.jinro_cpu_win(p_uid text, p_secret text, p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare g jinro_cpu_games; got int; pay int; c int;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into g from jinro_cpu_games where id = p_game and uid = p_uid for update;
  if not found then raise exception 'notfound'; end if;
  if g.won then raise exception 'already'; end if;
  if now() - g.started_at < interval '20 seconds' then raise exception 'fast'; end if;
  select coalesce(sum(reward), 0) into got from jinro_cpu_games where uid = p_uid and day = jinro_today();
  pay := greatest(0, least(jinro_cpu_reward(g.level), 50 - got));
  update jinro_cpu_games set won = true, reward = pay where id = p_game;
  insert into jinro_wallets(uid) values (p_uid) on conflict do nothing;
  update jinro_wallets set coins = coins + pay where uid = p_uid returning coins into c;
  return json_build_object('coins', c, 'reward', pay, 'today', got + pay, 'cap', 50);
end $$;

grant execute on function public.jinro_cpu_start(text,text,text), public.jinro_cpu_win(text,text,uuid) to anon, authenticated;
