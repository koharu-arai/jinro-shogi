-- ========== 人狼将棋 v7: ストーリー続編(第4〜6章・ステージ制)の経験値対応 ==========
-- jinro_story_clear の許可ステージと経験値を拡張するだけ。他のオブジェクトには触れない。
-- ステージID: s4-1〜s4-3 / s4-boss、s5-*、s6-*。経験値: 通常ステージ+40 / ボス+120 / 最終ボス(s6-boss)+300。
-- 既存の ch1〜ch3(+100 / ch3は+300) はそのまま。冪等(create or replace)。

create or replace function public.jinro_story_clear(p_uid text, p_secret text, p_stage text) returns json
language plpgsql security definer set search_path = public as $$
declare inserted int; gain int := 0; ex json;
begin
  perform jinro_auth(p_uid, p_secret);
  if p_stage not in ('ch1', 'ch2', 'ch3',
      's4-1', 's4-2', 's4-3', 's4-boss',
      's5-1', 's5-2', 's5-3', 's5-boss',
      's6-1', 's6-2', 's6-3', 's6-boss') then raise exception 'stage'; end if;
  insert into jinro_story_clears(uid, stage) values (p_uid, p_stage) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    gain := case
      when p_stage = 'ch3' or p_stage = 's6-boss' then 300
      when p_stage like '%boss' then 120
      when p_stage like 's%' then 40
      else 100 end;
    ex := jinro_add_exp(p_uid, gain);
  else
    ex := jinro_add_exp(p_uid, 0);
  end if;
  return json_build_object('stage', p_stage, 'boss', (p_stage = 'ch3' or p_stage like '%boss'), 'first', inserted > 0,
    'exp_gain', (ex->>'gain')::int, 'exp', (ex->>'exp')::int,
    'level_before', (ex->>'level_before')::int, 'level_after', (ex->>'level_after')::int,
    'coins_gain', (ex->>'coins_gain')::int, 'milestones', ex->'milestones');
end $$;
grant execute on function public.jinro_story_clear(text, text, text) to anon, authenticated;
