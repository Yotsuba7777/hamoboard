# ハモボード セットアップ手順

新規アカウントは **GitHubアカウント1つだけ**、クレジットカード登録は**不要**です。
上から順番にやれば完成します。所要時間の目安:30〜40分。

---

## 1. Supabaseプロジェクトを作る

1. https://supabase.com/dashboard にアクセス
2. 「Sign in with GitHub」を選び、サークル用のGitHubアカウントでログイン
   (Supabase用に新しいアカウントは作りません)
3. 「New project」→ 組織(Organization)がなければ作成 → プロジェクト名を `hamoboard` などにする
4. データベースのパスワードを設定する(**必ずパスワード管理ツールなどに保存**。あとで使います)
5. Region は `Northeast Asia (Tokyo)` を選ぶと表示が速くなります
6. 「Create new project」→ 数分待つ

## 2. データベースを作る

1. 左メニューの「SQL Editor」を開く
2. 「New query」を押して、このリポジトリの `supabase/schema.sql` の中身を **全部** コピー&ペースト
3. 右下の「RUN」を押す → 下に success と出れば完了
4. 招待コードを自分たちの好きな文字列に変更する(初期値は `billperu2025` のままなので、必ず変更してください):
   ```sql
   update app_config set invite_code = '好きな招待コード' where id = 1;
   ```
   これもSQL Editorに貼り付けてRUNするだけです。

## 3. メール確認をOFFにする

招待コードで既に絞っているので、メールアドレスの確認メールは省略します。

1. 左メニューの「Authentication」→「Providers」→「Email」を開く
2. 「Confirm email」のスイッチをOFFにする
3. 「Save」

## 4. 接続情報をアプリに入れる

1. 左メニューの「Project Settings」(歯車アイコン)→「API」を開く
2. 「Project URL」と「anon public」キーをコピー
3. このリポジトリの `js/supabase-client.js` を開いて、以下を書き換える
   ```js
   const SUPABASE_URL = "コピーしたProject URL";
   const SUPABASE_ANON_KEY = "コピーしたanon publicキー";
   ```
   ※ この2つの値は「公開してよい値」です。GitHubに上げても問題ありません。

## 5. GitHub Pagesで公開する

1. このリポジトリのファイル一式をGitHub(サークル用アカウント)にpushする
2. リポジトリの「Settings」→「Pages」を開く
3. 「Branch」で `main` を選んで「Save」
4. 数分後に `https://(アカウント名).github.io/(リポジトリ名)/` でアクセスできるようになります

## 6. 自動生存確認(keep-alive)を設定する

Supabaseの無料プランは7日間アクセスがないと一時停止するので、自動でアクセスする仕組みを設定します。

1. リポジトリの「Settings」→「Secrets and variables」→「Actions」を開く
2. 「New repository secret」で2つ登録する
   - `SUPABASE_URL` : 手順4でコピーしたProject URL
   - `SUPABASE_ANON_KEY` : 手順4でコピーしたanon publicキー
3. これで `.github/workflows/keep-alive.yml` が3日おきに自動実行され、二度と一時停止しなくなります
4. 動作確認したい場合は「Actions」タブ →「Keep Supabase Alive」→「Run workflow」で手動実行できます

---

## 動作確認チェックリスト

- [ ] signup.html から招待コードを使って新規登録できる
- [ ] ログイン後、掲示板(index.html)が表示される
- [ ] 「＋新しく募集を出す」からバンド募集が投稿できる
- [ ] メンバー紹介ページに、登録したメンバーが表示される
- [ ] マイページでプロフィールを編集して保存できる
- [ ] ログアウトできる

## 引き継ぎ時に次の担当者へ渡すもの

- サークル用GitHubアカウントのログイン情報
- Supabaseのデータベースパスワード(手順1で設定したもの)
- 招待コード(現在の値)
- このREADME

これさえあれば、Firebase/Google関連の手続きは一切不要です。
