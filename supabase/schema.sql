-- ============================================================
-- ハモボード データベース設計
-- Supabaseダッシュボード > SQL Editor に、このファイルの中身を
-- 全部貼り付けて「RUN」を押すだけでセットアップ完了します。
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0. 更新日時を自動で入れる共通関数
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. app_config : 招待コードなど、アプリ全体の設定を1行だけ持つ
--    直接は誰からも読めない(RLSでSELECTを許可しない)。
--    下の check_invite_code() 関数を経由してのみ照合できる。
-- ------------------------------------------------------------
create table if not exists app_config (
  id integer primary key default 1,
  invite_code text not null,
  circle_name text not null default 'ビリぺル',
  constraint single_row check (id = 1)
);

alter table app_config enable row level security;
-- ポリシーを1つも作らない = 誰も直接SELECT/INSERT/UPDATEできない

-- 最初の招待コードを設定(あとでいつでも変更可能)
insert into app_config (id, invite_code, circle_name)
values (1, 'billperu2025', 'ビリぺル')
on conflict (id) do nothing;

-- 招待コードが正しいかどうかだけを返す関数(値そのものは漏らさない)
create or replace function check_invite_code(input_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_config where invite_code = input_code
  );
$$;

grant execute on function check_invite_code(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. profiles : メンバー自己紹介欄
--    auth.users(Supabaseの認証ユーザー)と1:1で対応
-- ------------------------------------------------------------

-- 期(例:"17")ごとに、現在何人に出席番号を振ったかを1行で持つカウンター
-- (退会してもここは減らないので、番号が再利用されることはない)
create table if not exists period_counters (
  period text primary key,
  last_number integer not null default 0
);

alter table period_counters enable row level security;
-- ポリシーを1つも作らない = 誰も直接SELECT/INSERT/UPDATEできない
-- (採番はsecurity definerのトリガー関数からのみ行われる)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  parts text[] not null default '{}',
  motivation text default '',
  grade text default '',
  period text default '',
  favorite_artist text default '',
  bio text default '',
  -- 出席番号:「期を3桁ゼロ埋め」+「期の中での通し番号を2桁ゼロ埋め」の5桁。
  -- 期を初めて設定した時にサーバー側で自動採番され、以後は本人も変更できない
  attendance_number text default '',
  -- ホスト(サークル運営側)は自分以外の投稿も削除できる
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- 新規会員登録が完了したら、自動的にprofilesへ1行作る
-- (サインアップ時に渡した display_name / period / grade を拾う)
-- periodが数字で渡されていれば、その期の中で次の出席番号を割り振る
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_seq integer;
  v_attendance_number text;
begin
  v_period := nullif(coalesce(new.raw_user_meta_data->>'period', ''), '');

  if v_period is not null and v_period ~ '^[0-9]+$' then
    insert into period_counters (period, last_number)
    values (v_period, 1)
    on conflict (period) do update set last_number = period_counters.last_number + 1
    returning last_number into v_seq;

    v_attendance_number := lpad(v_period, 3, '0') || lpad(v_seq::text, 2, '0');
  end if;

  insert into public.profiles (id, display_name, period, grade, attendance_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '名称未設定'),
    coalesce(v_period, ''),
    coalesce(new.raw_user_meta_data->>'grade', ''),
    v_attendance_number
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- マイページで初めて「期」を数字で入力した時に、同じ仕組みで出席番号を割り振る。
-- 一度割り振られた期・出席番号は、その後変更しようとしても元に戻す(ロックする)
create or replace function handle_period_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  if (old.period is null or old.period = '') and new.period is not null and new.period <> '' then
    if new.period ~ '^[0-9]+$' then
      insert into period_counters (period, last_number)
      values (new.period, 1)
      on conflict (period) do update set last_number = period_counters.last_number + 1
      returning last_number into v_seq;

      new.attendance_number := lpad(new.period, 3, '0') || lpad(v_seq::text, 2, '0');
    else
      -- 数字以外が入力された場合は期を空のまま据え置く(エラーにはしない)
      new.period := old.period;
    end if;
  elsif new.period is distinct from old.period then
    new.period := old.period;
    new.attendance_number := old.attendance_number;
  else
    new.attendance_number := old.attendance_number;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_handle_period_set on profiles;
create trigger profiles_handle_period_set
  before update on profiles
  for each row execute function handle_period_set();

-- ------------------------------------------------------------
-- 3. bands : バンド募集掲示板
-- ------------------------------------------------------------
create table if not exists bands (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre text default '',
  description text default '',
  needed_parts text[] not null default '{}',
  deadline text,
  status text not null default '募集中' check (status in ('募集中', '締切')),
  -- trueの場合、誰がどのパートにリアクションしたか全員に表示する
  reactions_public boolean not null default false,
  -- 楽譜のURL(任意入力、形式チェックはしない)
  sheet_music_url text default '',
  -- profiles(id)を参照することで、投稿一覧を取得するときに
  -- リーダーの表示名を一緒に(JOINで)取得できるようにしている
  leader_id uuid not null references profiles(id) on delete cascade,
  contact text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bands enable row level security;

create policy "bands_select_authenticated"
  on bands for select
  to authenticated
  using (true);

create policy "bands_insert_own"
  on bands for insert
  to authenticated
  with check (auth.uid() = leader_id);

create policy "bands_update_own"
  on bands for update
  to authenticated
  using (auth.uid() = leader_id)
  with check (auth.uid() = leader_id);

create policy "bands_delete_own_or_host"
  on bands for delete
  to authenticated
  using (
    auth.uid() = leader_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_host)
  );

create trigger bands_set_updated_at
  before update on bands
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 4. reactions : 掲示板の♡リアクション(パートごと)
-- ------------------------------------------------------------
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  part text not null,
  created_at timestamptz not null default now(),
  unique (band_id, user_id, part)
);

alter table reactions enable row level security;

create policy "reactions_select_authenticated"
  on reactions for select
  to authenticated
  using (true);

create policy "reactions_insert_own"
  on reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "reactions_delete_own"
  on reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. notifications : 自分の募集にリアクションが来た通知
--    reactionsへのinsertをトリガーに自動で1行作られる
--    (リーダー自身のリアクションは通知しない)
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  part text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function handle_new_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leader_id uuid;
begin
  select leader_id into v_leader_id from bands where id = new.band_id;

  if v_leader_id is not null and v_leader_id <> new.user_id then
    insert into notifications (user_id, band_id, actor_id, part)
    values (v_leader_id, new.band_id, new.user_id, new.part);
  end if;

  return new;
end;
$$;

drop trigger if exists on_reaction_created on reactions;
create trigger on_reaction_created
  after insert on reactions
  for each row execute function handle_new_reaction();

-- ------------------------------------------------------------
-- 6. 締切済み募集の自動お片付け
--    締切にしてから30日経った投稿を、毎日AM3:00(UTC)に自動削除する
-- ------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-old-closed-bands') then
    perform cron.unschedule('delete-old-closed-bands');
  end if;
end $$;

select cron.schedule(
  'delete-old-closed-bands',
  '0 3 * * *',
  $$ delete from bands where status = '締切' and updated_at < now() - interval '30 days'; $$
);

-- ------------------------------------------------------------
-- 7. 生存確認(keep-alive)用の超軽量ビュー
--    GitHub Actionsから定期的にSELECTするためだけの存在
-- ------------------------------------------------------------
create or replace view keep_alive as select 1 as ok;
grant select on keep_alive to anon;

-- ------------------------------------------------------------
-- 8. 機能追加分の反映(既存のSupabaseプロジェクトを更新する場合)
--    新規セットアップの場合は上のCREATE TABLEに既に含まれているため不要です。
--    既にプロジェクトを作成済みの場合は、SQL Editorにこのブロックだけを
--    貼り付けてRUNしてください。
-- ------------------------------------------------------------
alter table profiles add column if not exists parts text[] not null default '{}';
alter table profiles add column if not exists motivation text default '';
alter table profiles add column if not exists period text default '';
alter table profiles add column if not exists favorite_artist text default '';
alter table profiles add column if not exists is_host boolean not null default false;
alter table profiles add column if not exists attendance_number text default '';

alter table bands alter column deadline type text using deadline::text;
alter table bands add column if not exists reactions_public boolean not null default false;
alter table bands add column if not exists sheet_music_url text default '';

-- 募集の削除を「投稿者本人」または「ホスト」だけができるように更新
drop policy if exists "bands_delete_own" on bands;
drop policy if exists "bands_delete_own_or_host" on bands;
create policy "bands_delete_own_or_host"
  on bands for delete
  to authenticated
  using (
    auth.uid() = leader_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_host)
  );

-- notifications機能の追加分(reactionsテーブルは既存のものをそのまま利用)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  part text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function handle_new_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leader_id uuid;
begin
  select leader_id into v_leader_id from bands where id = new.band_id;

  if v_leader_id is not null and v_leader_id <> new.user_id then
    insert into notifications (user_id, band_id, actor_id, part)
    values (v_leader_id, new.band_id, new.user_id, new.part);
  end if;

  return new;
end;
$$;

drop trigger if exists on_reaction_created on reactions;
create trigger on_reaction_created
  after insert on reactions
  for each row execute function handle_new_reaction();

-- 締切済み募集の自動削除(締切から30日後、毎日AM3:00 UTCに実行)
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-old-closed-bands') then
    perform cron.unschedule('delete-old-closed-bands');
  end if;
end $$;

select cron.schedule(
  'delete-old-closed-bands',
  '0 3 * * *',
  $$ delete from bands where status = '締切' and updated_at < now() - interval '30 days'; $$
);

-- 出席番号の自動採番機能の追加分
create table if not exists period_counters (
  period text primary key,
  last_number integer not null default 0
);

alter table period_counters enable row level security;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_seq integer;
  v_attendance_number text;
begin
  v_period := nullif(coalesce(new.raw_user_meta_data->>'period', ''), '');

  if v_period is not null and v_period ~ '^[0-9]+$' then
    insert into period_counters (period, last_number)
    values (v_period, 1)
    on conflict (period) do update set last_number = period_counters.last_number + 1
    returning last_number into v_seq;

    v_attendance_number := lpad(v_period, 3, '0') || lpad(v_seq::text, 2, '0');
  end if;

  insert into public.profiles (id, display_name, period, grade, attendance_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '名称未設定'),
    coalesce(v_period, ''),
    coalesce(new.raw_user_meta_data->>'grade', ''),
    v_attendance_number
  );
  return new;
end;
$$;

create or replace function handle_period_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  if (old.period is null or old.period = '') and new.period is not null and new.period <> '' then
    if new.period ~ '^[0-9]+$' then
      insert into period_counters (period, last_number)
      values (new.period, 1)
      on conflict (period) do update set last_number = period_counters.last_number + 1
      returning last_number into v_seq;

      new.attendance_number := lpad(new.period, 3, '0') || lpad(v_seq::text, 2, '0');
    else
      new.period := old.period;
    end if;
  elsif new.period is distinct from old.period then
    new.period := old.period;
    new.attendance_number := old.attendance_number;
  else
    new.attendance_number := old.attendance_number;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_handle_period_set on profiles;
create trigger profiles_handle_period_set
  before update on profiles
  for each row execute function handle_period_set();

-- 既存メンバーのうち、期が数字で設定済み・出席番号がまだない人に
-- 期ごとに登録が古い順(created_at順)で出席番号を割り振る
-- (このUPDATE自体もprofiles_handle_period_setトリガーを起動させてしまい、
--  「期が変わっていないから出席番号を元に戻す」処理で上書きされてしまうため、
--  バックフィル中だけトリガーを一時的に無効化する)
alter table profiles disable trigger profiles_handle_period_set;

with numbered as (
  select id, period, row_number() over (partition by period order by created_at) as rn
  from profiles
  where period ~ '^[0-9]+$'
    and (attendance_number is null or attendance_number = '')
)
update profiles p
set attendance_number = lpad(numbered.period, 3, '0') || lpad(numbered.rn::text, 2, '0')
from numbered
where p.id = numbered.id;

alter table profiles enable trigger profiles_handle_period_set;

-- 上の割り振りに合わせて、今後の採番が重複しないようカウンターを揃える
insert into period_counters (period, last_number)
select period, count(*)
from profiles
where period ~ '^[0-9]+$' and attendance_number is not null and attendance_number <> ''
group by period
on conflict (period) do update
set last_number = greatest(period_counters.last_number, excluded.last_number);

-- ============================================================
-- 以上でテーブル・権限設定は完了です。
-- 次にやること:
-- 1. 上の insert文にある 'billperu2025' を実際の招待コードに変更したい場合は
--    SQL Editorで下記を実行:
--    update app_config set invite_code = '好きな招待コード' where id = 1;
-- 2. Authentication > Providers > Email で
--    「Confirm email」をOFFにする(招待コードで既に絞っているため)
-- ============================================================
