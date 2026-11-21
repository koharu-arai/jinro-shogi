-- 人狼将棋 v2:コイン・ログインボーナス・ミッション・ガチャ・着せ替え・称号・スタンプ・フレンド
-- supabase.sql を実行済みのプロジェクトに、追加でこのファイルを実行する。
-- コインや持ち物は、ブラウザから直接書きかえられないようにし、必ず下の関数(RPC)を通して変更する。

-- ========== テーブル ==========
create table if not exists public.jinro_secrets (      -- 端末ごとの合言葉(ハッシュ)。誰からも読めない
  uid text primary key,
  secret_hash text not null
);
create table if not exists public.jinro_wallets (      -- コインとログイン状況
  uid text primary key,
  coins int not null default 0,
  streak int not null default 0,
  last_login date,
  welcomed boolean not null default false,
  tokens int not null default 0
);
alter table public.jinro_wallets add column if not exists tokens int not null default 0;
create table if not exists public.jinro_inventory (    -- 持っている景品
  uid text not null,
  item text not null,
  created_at timestamptz not null default now(),
  primary key (uid, item)
);
create table if not exists public.jinro_items (        -- ガチャの景品一覧(抽選用)
  id text primary key,
  kind text not null,
  rarity text not null check (rarity in ('N','R','SR','SSR','LR'))
);
alter table public.jinro_items add column if not exists gacha boolean not null default true;
alter table public.jinro_items add column if not exists banner text;   -- LRキャラが出る曜日ガチャ(A=月水土 / B=火木金)
create table if not exists public.jinro_achievements (   -- アチーブメント(catalog.js から生成)
  id text primary key, stat text not null, goal int not null, coins int not null default 0, tokens int not null default 0, item text
);
create table if not exists public.jinro_ach_claims (
  uid text not null, ach text not null, created_at timestamptz not null default now(), primary key (uid, ach)
);
create table if not exists public.jinro_mission_claims (
  uid text not null,
  day date not null,
  mission text not null,
  primary key (uid, day, mission)
);
create table if not exists public.jinro_chat (         -- 対戦中のスタンプ
  id bigint generated always as identity primary key,
  code text not null,
  uid text not null,
  item text not null,
  created_at timestamptz not null default now()
);
create index if not exists jinro_chat_code on public.jinro_chat (code, created_at);
create index if not exists jinro_chat_uid on public.jinro_chat (uid, created_at);
create table if not exists public.jinro_friends (      -- a < b の順で1行。status: pending / accepted
  a text not null,
  b text not null,
  status text not null default 'pending',
  requested_by text not null,
  created_at timestamptz not null default now(),
  primary key (a, b)
);
create table if not exists public.jinro_invites (      -- フレンドからの対戦の誘い
  id bigint generated always as identity primary key,
  from_uid text not null,
  to_uid text not null,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.jinro_players add column if not exists title text;
alter table public.jinro_players add column if not exists look jsonb not null default '{}'::jsonb;
alter table public.jinro_players add column if not exists friend_code text unique;
alter table public.jinro_players add column if not exists last_seen timestamptz;
alter table public.jinro_players add column if not exists avatar jsonb;
alter table public.jinro_seats add column if not exists look jsonb;

-- ========== アクセス制限 ==========
alter table public.jinro_secrets enable row level security;
alter table public.jinro_wallets enable row level security;
alter table public.jinro_inventory enable row level security;
alter table public.jinro_items enable row level security;
alter table public.jinro_mission_claims enable row level security;
alter table public.jinro_achievements enable row level security;
alter table public.jinro_ach_claims enable row level security;
alter table public.jinro_chat enable row level security;
alter table public.jinro_friends enable row level security;
alter table public.jinro_invites enable row level security;
-- 読めるのは景品一覧とスタンプだけ(スタンプはリアルタイムで相手に届けるため)
alter table public.jinro_items drop constraint if exists jinro_items_rarity_check;
alter table public.jinro_items add constraint jinro_items_rarity_check check (rarity in ('N','R','SR','SSR','LR'));
drop policy if exists "jinro items read" on public.jinro_items;
create policy "jinro items read" on public.jinro_items for select using (true);
drop policy if exists "jinro chat read" on public.jinro_chat;
create policy "jinro chat read" on public.jinro_chat for select using (true);
-- 名前・称号と対戦結果は、関数を通してだけ書けるようにする(読むのは今まで通り誰でも)
drop policy if exists "jinro players insert" on public.jinro_players;
drop policy if exists "jinro players update" on public.jinro_players;
drop policy if exists "jinro results insert" on public.jinro_results;

do $$ begin
  begin alter publication supabase_realtime add table public.jinro_chat; exception when duplicate_object then null; end;
end $$;

-- ========== 共通 ==========
create or replace function public.jinro_today() returns date language sql stable as
$$ select (now() at time zone 'Asia/Tokyo')::date $$;

-- 合言葉の確認。はじめての端末なら登録する
create or replace function public.jinro_auth(p_uid text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare h text := encode(sha256(convert_to(coalesce(p_secret,''), 'UTF8')), 'hex'); cur text;
begin
  if p_uid is null or length(p_uid) < 8 or p_secret is null or length(p_secret) < 16 then raise exception 'auth'; end if;
  select secret_hash into cur from jinro_secrets where uid = p_uid;
  if cur is null then insert into jinro_secrets(uid, secret_hash) values (p_uid, h) on conflict (uid) do nothing;
  elsif cur <> h then raise exception 'auth'; end if;
  insert into jinro_wallets(uid) values (p_uid) on conflict (uid) do nothing;
end $$;

create or replace function public.jinro_gen_code() returns text language plpgsql as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; s text; i int;
begin
  loop
    s := ''; for i in 1..6 loop s := s || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from jinro_players where friend_code = s);
  end loop;
  return s;
end $$;

-- ========== 名前 ==========
create or replace function public.jinro_set_name(p_uid text, p_secret text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_name, ''));
begin
  perform jinro_auth(p_uid, p_secret);
  if char_length(n) < 1 or char_length(n) > 12 then raise exception 'name'; end if;
  insert into jinro_players(uid, name, friend_code, updated_at) values (p_uid, n, jinro_gen_code(), now())
  on conflict (uid) do update set name = excluded.name, updated_at = now(),
    friend_code = coalesce(jinro_players.friend_code, excluded.friend_code);
  return json_build_object('ok', true);
end $$;

-- ========== 状態(ホーム画面でまとめて読む) ==========
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
        'uid', o.uid, 'name', p.name, 'title', p.title, 'avatar', p.avatar, 'status', f.status, 'incoming', (f.status = 'pending' and f.requested_by <> p_uid),
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

-- ========== アチーブメント ==========
create or replace function public.jinro_stats(p_uid text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'wins',    (select count(*) from jinro_results where uid = p_uid and win),
    'games',   (select count(*) from jinro_results where uid = p_uid),
    'ssr',     (select count(*) from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and t.kind = 'char' and t.rarity = 'SSR'),
    'chars',   (select count(*) from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and t.kind = 'char'),
    'friends', (select count(*) from jinro_friends where (a = p_uid or b = p_uid) and status = 'accepted'))
$$;
create or replace function public.jinro_claim_achievement(p_uid text, p_secret text, p_ach text) returns json
language plpgsql security definer set search_path = public as $$
declare a jinro_achievements; v int; c int; tk int;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into a from jinro_achievements where id = p_ach;
  if a.id is null then raise exception 'ach'; end if;
  v := (jinro_stats(p_uid) ->> a.stat)::int;
  if v < a.goal then raise exception 'notyet'; end if;
  insert into jinro_ach_claims(uid, ach) values (p_uid, p_ach);
  if a.item is not null then insert into jinro_inventory(uid, item) values (p_uid, a.item) on conflict do nothing; end if;
  update jinro_wallets set coins = coins + a.coins, tokens = tokens + a.tokens where uid = p_uid returning coins, tokens into c, tk;
  return json_build_object('coins', c, 'tokens', tk, 'item', a.item);
exception when unique_violation then raise exception 'already';
end $$;
grant execute on function public.jinro_claim_achievement(text,text,text) to anon, authenticated;
revoke execute on function public.jinro_stats(text) from anon, authenticated, public;

-- ========== ログインボーナス ==========
create or replace function public.jinro_claim_login(p_uid text, p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare w jinro_wallets; d date := jinro_today(); st int; reward int; welcome int := 0;
begin
  perform jinro_auth(p_uid, p_secret);
  select * into w from jinro_wallets where uid = p_uid for update;
  if w.last_login = d then raise exception 'already'; end if;
  st := case when w.last_login = d - 1 then w.streak + 1 else 1 end;
  reward := 20 + case when st % 7 = 0 then 100 else 0 end;
  if not w.welcomed then welcome := 900; end if;
  update jinro_wallets set coins = coins + reward + welcome, streak = st, last_login = d, welcomed = true where uid = p_uid;
  return json_build_object('reward', reward, 'welcome', welcome, 'streak', st, 'coins', w.coins + reward + welcome);
end $$;

-- ========== デイリーミッション ==========
create or replace function public.jinro_claim_mission(p_uid text, p_secret text, p_mission text) returns json
language plpgsql security definer set search_path = public as $$
declare d date := jinro_today(); cnt int; c int;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_mission = 'm_play' then select count(*) into cnt from jinro_results where uid = p_uid and (created_at at time zone 'Asia/Tokyo')::date = d;
  elsif p_mission = 'm_win' then select count(*) into cnt from jinro_results where uid = p_uid and win and (created_at at time zone 'Asia/Tokyo')::date = d;
  elsif p_mission = 'm_stamp' then select count(*) into cnt from jinro_chat where uid = p_uid and (created_at at time zone 'Asia/Tokyo')::date = d;
  else raise exception 'mission'; end if;
  if cnt < 1 then raise exception 'notyet'; end if;
  insert into jinro_mission_claims(uid, day, mission) values (p_uid, d, p_mission);
  update jinro_wallets set coins = coins + 10 where uid = p_uid returning coins into c;
  return json_build_object('coins', c);
exception when unique_violation then raise exception 'already';
end $$;

-- ========== ガチャ ==========
drop function if exists public.jinro_gacha(text,text,int);
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

-- ========== 着せ替え・称号を付ける ==========
create or replace function public.jinro_equip(p_uid text, p_secret text, p_slot text, p_item text) returns json
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_slot not in ('title','skin','frame','back','wolf') then raise exception 'slot'; end if;
  if p_item is not null then
    select kind into k from jinro_items where id = p_item;
    if k is distinct from p_slot or not exists (select 1 from jinro_inventory where uid = p_uid and item = p_item) then raise exception 'notowned'; end if;
  end if;
  if p_slot = 'title' then
    update jinro_players set title = p_item where uid = p_uid;
  else
    update jinro_players set look = case when p_item is null then coalesce(look,'{}'::jsonb) - p_slot
      else coalesce(look,'{}'::jsonb) || jsonb_build_object(p_slot, p_item) end where uid = p_uid;
  end if;
  return json_build_object('ok', true);
end $$;

-- ========== 対戦結果の記録 ==========
create or replace function public.jinro_record_result(p_uid text, p_secret text, p_code text, p_game_no int) returns json
language plpgsql security definer set search_path = public as $$
declare g jsonb; s int;
begin
  perform jinro_auth(p_uid, p_secret);
  select game into g from jinro_rooms where code = p_code;
  select seat into s from jinro_seats where code = p_code and uid = p_uid;
  if g is null or s is null or g->>'phase' <> 'over' or (g->>'startNo')::int <> p_game_no or g->>'winner' is null then raise exception 'state'; end if;
  insert into jinro_results(code, game_no, uid, win) values (p_code, p_game_no, p_uid, (g->>'winner')::int = s)
  on conflict do nothing;
  return json_build_object('win', (g->>'winner')::int = s);
end $$;

-- ========== 対戦中のスタンプ ==========
create or replace function public.jinro_send_stamp(p_uid text, p_secret text, p_code text, p_item text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jinro_auth(p_uid, p_secret);
  if not exists (select 1 from jinro_seats where code = p_code and uid = p_uid) then raise exception 'seat'; end if;
  if p_item not in ('s_hello','s_nice','s_thanks','s_hmm')
     and not exists (select 1 from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and i.item = p_item and t.kind = 'stamp') then
    raise exception 'notowned';
  end if;
  if exists (select 1 from jinro_chat where uid = p_uid and created_at > now() - interval '2 seconds') then raise exception 'slow'; end if;
  insert into jinro_chat(code, uid, item) values (p_code, p_uid, p_item);
  return json_build_object('ok', true);
end $$;

-- ========== フレンド ==========
create or replace function public.jinro_friend_request(p_uid text, p_secret text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare other text; x text; y text; f jinro_friends;
begin
  perform jinro_auth(p_uid, p_secret);
  select uid into other from jinro_players where friend_code = upper(btrim(p_code));
  if other is null then raise exception 'notfound'; end if;
  if other = p_uid then raise exception 'self'; end if;
  x := least(p_uid, other); y := greatest(p_uid, other);
  select * into f from jinro_friends where a = x and b = y;
  if f is null then
    insert into jinro_friends(a, b, status, requested_by) values (x, y, 'pending', p_uid);
    return json_build_object('status', 'pending');
  elsif f.status = 'pending' and f.requested_by <> p_uid then
    update jinro_friends set status = 'accepted' where a = x and b = y;
    return json_build_object('status', 'accepted');
  end if;
  return json_build_object('status', f.status);
end $$;

create or replace function public.jinro_friend_respond(p_uid text, p_secret text, p_other text, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare x text := least(p_uid, p_other); y text := greatest(p_uid, p_other);
begin
  perform jinro_auth(p_uid, p_secret);
  if p_accept then
    update jinro_friends set status = 'accepted' where a = x and b = y and status = 'pending' and requested_by <> p_uid;
  else
    delete from jinro_friends where a = x and b = y;   -- 断る・取り消す・フレンド解除
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.jinro_invite(p_uid text, p_secret text, p_to text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jinro_auth(p_uid, p_secret);
  if not exists (select 1 from jinro_friends where a = least(p_uid, p_to) and b = greatest(p_uid, p_to) and status = 'accepted') then raise exception 'notfriend'; end if;
  if not exists (select 1 from jinro_seats where code = p_code and uid = p_uid) then raise exception 'seat'; end if;
  insert into jinro_invites(from_uid, to_uid, code) values (p_uid, p_to, p_code);
  return json_build_object('ok', true);
end $$;

-- ========== 特別コインでSSRキャラと交換 ==========
create or replace function public.jinro_exchange(p_uid text, p_secret text, p_item text) returns json
language plpgsql security definer set search_path = public as $$
declare tk int;
begin
  perform jinro_auth(p_uid, p_secret);
  if not exists (select 1 from jinro_items where id = p_item and kind = 'char' and rarity = 'SSR') then raise exception 'exchange'; end if;
  if exists (select 1 from jinro_inventory where uid = p_uid and item = p_item) then raise exception 'already'; end if;
  select tokens into tk from jinro_wallets where uid = p_uid for update;
  if tk < 5 then raise exception 'tokens'; end if;
  update jinro_wallets set tokens = tokens - 5 where uid = p_uid returning tokens into tk;
  insert into jinro_inventory(uid, item) values (p_uid, p_item);
  return json_build_object('tokens', tk);
end $$;
grant execute on function public.jinro_exchange(text,text,text) to anon, authenticated;

-- ========== アイコン(アバター) ==========
create or replace function public.jinro_set_avatar(p_uid text, p_secret text, p_char text, p_bg int) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jinro_auth(p_uid, p_secret);
  if p_bg is null or p_bg < 0 or p_bg > 7 then raise exception 'avatar'; end if;
  if p_char not in ('king','wolf','villager','seer','hunter','knight')
     and not exists (select 1 from jinro_inventory i join jinro_items t on t.id = i.item where i.uid = p_uid and t.kind = 'char' and t.id = 'c_' || p_char) then
    raise exception 'notowned';
  end if;
  update jinro_players set avatar = jsonb_build_object('c', p_char, 'bg', p_bg) where uid = p_uid;
  return json_build_object('ok', true);
end $$;
grant execute on function public.jinro_set_avatar(text,text,text,int) to anon, authenticated;

-- 関数を誰でも呼べるようにする(中で合言葉を確認する)
grant execute on function public.jinro_set_name(text,text,text), public.jinro_state(text,text), public.jinro_claim_login(text,text),
  public.jinro_claim_mission(text,text,text), public.jinro_equip(text,text,text,text),
  public.jinro_record_result(text,text,text,int), public.jinro_send_stamp(text,text,text,text),
  public.jinro_friend_request(text,text,text), public.jinro_friend_respond(text,text,text,boolean),
  public.jinro_invite(text,text,text,text) to anon, authenticated;
revoke execute on function public.jinro_auth(text,text), public.jinro_gen_code() from anon, authenticated, public;

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
