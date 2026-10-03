-- 人狼将棋のオンライン対戦用テーブル
-- Supabase の SQL Editor に全部貼り付けて「Run」してください。

-- 部屋(盤面・手番・持ち時間などの対局状態を game にまとめて保存)
create table if not exists public.jinro_rooms (
  code text primary key,
  game jsonb not null,
  updated_at timestamptz not null default now()
);

-- 座席(0 = 先手 / 部屋を作った人、1 = 後手)と駒の配置
create table if not exists public.jinro_seats (
  code text not null references public.jinro_rooms(code) on delete cascade,
  seat int not null check (seat in (0, 1)),
  uid text not null,
  ready boolean not null default false,
  setup jsonb,
  primary key (code, seat)
);

-- ログインなしで遊べるよう、誰でも読み書きできる設定にしています
alter table public.jinro_rooms enable row level security;
alter table public.jinro_seats enable row level security;

drop policy if exists "jinro rooms open" on public.jinro_rooms;
create policy "jinro rooms open" on public.jinro_rooms for all using (true) with check (true);

drop policy if exists "jinro seats open" on public.jinro_seats;
create policy "jinro seats open" on public.jinro_seats for all using (true) with check (true);

-- 相手の手をリアルタイムに受け取るための設定
alter publication supabase_realtime add table public.jinro_rooms;
alter publication supabase_realtime add table public.jinro_seats;

-- 古い部屋を消したいとき(任意。7日以上動きのない部屋を削除)
-- delete from public.jinro_rooms where updated_at < now() - interval '7 days';
