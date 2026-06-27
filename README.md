# bluesky-rss

Blueskyのカスタムフィードを定期的にRSS 2.0形式に変換して公開するリポジトリです。

GitHub Actionsで毎時自動実行されます。

## 公開フィード

| フィード | RSS URL |
|---|---|
| 創作百合 | [`rss/sosaku-yuri.xml`](./rss/sosaku-yuri.xml) |

## セットアップ

### 1. Secrets の設定

リポジトリの **Settings → Secrets and variables → Actions** で以下を追加：

| Key | Value |
|---|---|
| `BSKY_IDENTIFIER` | BlueskyのHandle (例: yourname.bsky.social) |
| `BSKY_APP_PASSWORD` | App Password |

App Passwordは Bluesky **Settings → Privacy and security → App passwords** で発行。

### 2. GitHub Pages の有効化

**Settings → Pages → Source** を `GitHub Actions` ではなく `Deploy from a branch` に設定し、ブランチ `main` / フォルダ `/` (root) を選択。

### 3. 手動実行で動作確認

**Actions → Generate Bluesky RSS → Run workflow**

## RSS購読URL

```
https://[username].github.io/bluesky-rss/rss/sosaku-yuri.xml
```
