# 公開用メモ

`index.html` が自己完結した配布・公開用ファイルです。静的ホスティングの公開ディレクトリへ配置できます。
画像・音も同じHTMLに含まれます。ランタイムサーバーやデータベースは不要です。
編集後は `npm run build`、`npm test`、`npm run check` を実行します。

## 公開URL

- https://geneshokai.com/ato-sukoshi/

## GitHub Actions による自動デプロイ

`main` ブランチへの push（および Actions タブからの手動実行）で、ビルド済み `index.html` と、同じ公開ディレクトリに置く `sitemap.xml` およびアイコンを Xserver FTP へアップロードします。
開発はこのリポジトリで行い、公開先は上記 URL のみです。

### 初回セットアップ（リポジトリ管理者）

GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** で、次の 3 つを登録してください。

| Secret 名 | 値 |
|-----------|-----|
| `FTP_SERVER` | `sv13234.xserver.jp` |
| `FTP_USERNAME` | `ato-sukoshi@geneshokai.com` |
| `FTP_PASSWORD` | （Xserver FTP アカウントのパスワード。ここでは記載しません） |

Secret が未設定の場合、ワークフローは FTP 接続前に失敗し、どの Secret が不足しているか Actions ログに表示されます。

### デプロイ先（FTP）

- ホスト: `sv13234.xserver.jp`
- ユーザー: `ato-sukoshi@geneshokai.com`
- アップロード先: FTP アカウントのルート（`.`）。アカウントは `/home/xs062352/geneshokai.com/public_html/ato-sukoshi` に chroot 済みのため、ネストした `geneshokai.com` パスは不要です。
- アップロード対象は `scripts/shipped-files.mjs` の一覧です。ワークフローは `deploy/` に集めてから、3回のアップロードが同じ `deploy/` を送ります。
  - `index.html`（`npm run build` 後）
  - `manifest.webmanifest`（`npm run build` 後）
  - `sw.js`（`npm run build` 後）
  - `sitemap.xml`
  - `googlec3eaef4e4d6e686f.html`（Search Console の確認ファイル。sitemap には載せない）
  - `favicon-96.png`
  - `apple-touch-icon.png`
  - `favicon.ico`
  - `icon-192.png`
  - `icon-512.png`
  - `icon-512-maskable.png`

### 手動デプロイ

Actions → **Deploy to Xserver FTP** → **Run workflow** → ブランチ `main` を選んで実行。

## 公開前の確認

公開時には、実際の HTTPS の URL と iPhone/Android 実機で画像、音、消灯、20秒おためし、長押し、終了後の直接操作、設定保存を確認してください。
v9.8.0 以降、Service Worker と Web App Manifest により PWA としてインストール・オフライン利用できます。初回オンライン訪問後、アプリシェルがキャッシュされます。

### PC 手動デプロイ（fallback）

`C:\Users\aaa_a\ato-sukoshi-deploy\ato-deploy.cmd` が `index.html` だけを取得している場合、PWA 公開のため次も同じ FTP ディレクトリへアップロードしてください（ビルド後のリポジトリ／`deploy/` と同じ内容）。

1. `index.html`
2. `manifest.webmanifest`
3. `sw.js`
4. `sitemap.xml`
5. `googlec3eaef4e4d6e686f.html`
6. `favicon.ico`
7. `favicon-96.png`
8. `apple-touch-icon.png`
9. `icon-192.png`
10. `icon-512.png`
11. `icon-512-maskable.png`
