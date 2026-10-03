-- 名前と勝率のための追加テーブル(すでに supabase.sql を実行済みの場合はこれだけ実行)
-- プレイヤー名(端末ごとのID uid に名前をひも付け)
create table if not exists public.jinro_players (
  uid text primary key,
  name text not null check (char_length(name) between 1 and 12),
  updated_at timestamptz not null default now()
);

-- 対局結果(勝率の計算に使う。1対局につき各プレイヤー1行)
create table if not exists public.jinro_results (
  code text not null,
  game_no int not null,
  uid text not null,
  win boolean not null,
  created_at timestamptz not null default now(),
  primary key (code, game_no, uid)
);

alter table public.jinro_players enable row level security;
alter table public.jinro_results enable row level security;

drop policy if exists "jinro players read" on public.jinro_players;
create policy "jinro players read" on public.jinro_players for select using (true);
drop policy if exists "jinro players insert" on public.jinro_players;
create policy "jinro players insert" on public.jinro_players for insert with check (true);
drop policy if exists "jinro players update" on public.jinro_players;
create policy "jinro players update" on public.jinro_players for update using (true) with check (true);

drop policy if exists "jinro results read" on public.jinro_results;
create policy "jinro results read" on public.jinro_results for select using (true);
drop policy if exists "jinro results insert" on public.jinro_results;
create policy "jinro results insert" on public.jinro_results for insert with check (true);
