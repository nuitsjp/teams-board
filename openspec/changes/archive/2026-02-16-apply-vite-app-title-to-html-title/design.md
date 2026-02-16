## Context

`index.html` の `<title>Teams Board</title>` がハードコードされており、ビルド時の環境変数 `VITE_APP_TITLE` が反映されない。`App.jsx` のヘッダーテキストは `import.meta.env.VITE_APP_TITLE || 'Teams Board'` で既に対応済みであるため、`<title>` タグのみが未対応の状態である。

## Goals / Non-Goals

**Goals:**

- `VITE_APP_TITLE` の値を `<title>` タグに反映する
- 環境変数未設定時はデフォルト値「Teams Board」を維持する

**Non-Goals:**

- SPA 内でのページ遷移ごとの動的タイトル変更（将来的な拡張として別 Issue で対応）
- `<meta>` タグ（description 等）の動的設定

## Decisions

### Vite の `transformIndexHtml` フックを使用する

**選択肢:**

1. **Vite プラグイン（`transformIndexHtml`）** — ビルド時に `index.html` の `<title>` を置換
2. **React 側で `document.title` を設定** — `main.jsx` や `App.jsx` で JavaScript から設定

**決定: 選択肢 1（Vite プラグイン）**

**理由:**

- ビルド成果物の `index.html` に最初からタイトルが埋め込まれるため、HTML パース時点で正しいタイトルが設定される
- JavaScript の読み込み・実行を待たずにブラウザタブに正しいタイトルが表示される
- SEO やソーシャルシェアのクローラーが JavaScript を実行しないケースにも対応できる
- `index.html` 内で `%VITE_APP_TITLE%` のようなプレースホルダーを使う慣用的なパターンであり、Vite のエコシステムに自然に統合される

**選択肢 2 を採用しない理由:**

- JavaScript の実行まで `<title>` がプレースホルダーまたは空のままになる（FOUC ならぬ FOUT）
- ブラウザの「戻る」操作時のタブタイトルが不安定になる可能性がある

### 実装方式

`vite.config.js` に Vite の `transformIndexHtml` フックを持つプラグインを追加する。`index.html` 内では `<title>%VITE_APP_TITLE%</title>` のようなプレースホルダーを使用し、プラグインがビルド時に `import.meta.env.VITE_APP_TITLE` の値（未設定時は「Teams Board」）で置換する。

Vite は `envPrefix`（デフォルト: `VITE_`）に合致する環境変数を `import.meta.env` に自動で読み込むため、プラグインはこの値を参照できる。

## Risks / Trade-offs

- **リスク: プレースホルダーが置換されないケース** → `transformIndexHtml` は開発サーバーとビルドの両方で動作するため、すべてのモードでカバーされる。フォールバック値「Teams Board」をプラグイン内で保証する。
