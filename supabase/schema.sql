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
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  part text default '未設定',
  grade text default '',
  bio text default '',
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
-- (サインアップ時に渡した display_name / part / grade を拾う)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, part, grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '名称未設定'),
    coalesce(new.raw_user_meta_data->>'part', '未設定'),
    coalesce(new.raw_user_meta_data->>'grade', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- 3. bands : バンド募集掲示板
-- ------------------------------------------------------------
create table if not exists bands (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre text default '',
  description text default '',
  needed_parts text[] not null default '{}',
  deadline date,
  status text not null default '募集中' check (status in ('募集中', '締切')),
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

create policy "bands_delete_own"
  on bands for delete
  to authenticated
  using (auth.uid() = leader_id);

create trigger bands_set_updated_at
  before update on bands
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 4. 生存確認(keep-alive)用の超軽量ビュー
--    GitHub Actionsから定期的にSELECTするためだけの存在
-- ------------------------------------------------------------
create or replace view keep_alive as select 1 as ok;
grant select on keep_alive to anon;

-- ============================================================
-- 以上でテーブル・権限設定は完了です。
-- 次にやること:
-- 1. 上の insert文にある 'billperu2025' を実際の招待コードに変更したい場合は
--    SQL Editorで下記を実行:
--    update app_config set invite_code = '好きな招待コード' where id = 1;
-- 2. Authentication > Providers > Email で
--    「Confirm email」をOFFにする(招待コードで既に絞っているため)
-- ============================================================
