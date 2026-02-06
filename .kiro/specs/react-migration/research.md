# Research & Design Decisions: react-migration

## Summary
- **Feature**: `react-migration`
- **Discovery Scope**: Complex Integration（Vanilla JS → React全面移行）
- **Key Findings**:
  - React Router v7（7.13.0）はHashRouterを完全サポート。`createHashRouter` + `RouterProvider`が推奨API
  - PapaParseはViteプロジェクトで特別な設定なしに`import Papa from 'papaparse'`で使用可能
  - `crypto.subtle`はVitestのjsdom環境ではデフォルト未対応。`vitest.setup.js`でNode.jsのwebcryptoをポリフィルする必要あり
  - Playwright MCPは標準E2Eテストとは別のAI駆動自動化レイヤー。E2Eテスト自体は標準の`@playwright/test`を使用

## Research Log

### React Router v7 HashRouter対応
- **Context**: 既存のハッシュベースルーティング（`#/`, `#/members/<id>`）をReact Routerで実現する必要がある
- **Sources Consulted**: React Router公式ドキュメント、npmレジストリ、マイグレーションガイド
- **Findings**:
  - React Router v7（7.13.0）は`HashRouter`コンポーネントと`createHashRouter`関数の両方をサポート
  - `createHashRouter`はデータルーターAPIに対応し、loaderやactionが使用可能
  - v6→v7の移行は基本的に非破壊的。future flagsを有効にしていれば既存コードはそのまま動作
  - `path="*"`でキャッチオールルート（404）を実装可能
- **Implications**: `createHashRouter`を採用し、ルート定義を配列形式で管理。`<Navigate to="/">`でキャッチオールルートをダッシュボードにリダイレクト

### Vite + React 19 JSXセットアップ
- **Context**: ビルドツールなし（ES Modules直接配信）からViteベースのビルドパイプラインへ移行
- **Sources Consulted**: Vite公式ドキュメント、@vitejs/plugin-react、React 19リリースノート
- **Findings**:
  - `@vitejs/plugin-react`最新版はReact 19対応済み。自動JSXランタイム、Fast Refreshをサポート
  - `.jsx`拡張子でJSXファイルを識別する方式が推奨（`.js`でのJSXは追加設定が必要）
  - `build.outDir`で出力ディレクトリを任意に指定可能
  - パスエイリアス（`@/`）はresolve.aliasで設定可能
- **Implications**: `.jsx`拡張子を使用。Vite設定は最小限に保ちReactプラグインのデフォルト動作を活用

### PapaParse Viteバンドル
- **Context**: 現在importmap経由で静的ファイルとして配信しているPapaParseをnpm依存に移行
- **Sources Consulted**: papaparse npm、react-papaparse、Viteドキュメント
- **Findings**:
  - `npm install papaparse`後、`import Papa from 'papaparse'`で特別な設定なしに使用可能
  - Viteが自動的にESMバンドルを生成
  - `react-papaparse`ラッパーも存在するが、既存コードとの互換性を考慮し標準papaparseを使用
- **Implications**: papaparseをdependenciesに追加。importmapとpublic/lib/は不要になる

### crypto.subtle Vitest互換性
- **Context**: CsvTransformerのID生成で`crypto.subtle.digest('SHA-256')`を使用しているが、jsdom環境での動作可否
- **Sources Consulted**: Vitest GitHubイシュー、jsdomドキュメント
- **Findings**:
  - jsdom環境では`crypto.subtle`がデフォルトで未定義
  - `vitest.setup.js`で`import { webcrypto } from 'crypto'; global.crypto = webcrypto;`によるポリフィルで解決
  - `@peculiar/webcrypto`パッケージを使用する代替案もあるが、Node.js標準で十分
- **Implications**: vitest.setup.jsにwebcryptoポリフィルを追加。既存のCsvTransformerテストは修正不要

### Playwright E2E + Vite統合
- **Context**: E2Eテストを新規導入し、Vite devサーバーと連携して実行する
- **Sources Consulted**: Playwright公式ドキュメント、microsoft/playwright-mcp GitHub
- **Findings**:
  - `playwright.config.js`の`webServer`設定でVite devサーバーを自動起動可能
  - `reuseExistingServer: !process.env.CI`でローカル/CI環境を切り替え
  - Playwright MCPはAI駆動テスト自動化レイヤーで、標準E2Eテストには`@playwright/test`を使用
  - `screenshot: 'only-on-failure'`、`trace: 'on-first-retry'`が推奨設定
  - デフォルトでヘッドレスモード。CI環境では`workers: 1`で安定性を優先
- **Implications**: `@playwright/test`を使用した標準E2Eテストを構築。Playwright MCPはClaude Code連携で開発時のテスト補助に活用

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Option A: 段階的移行 | Vanilla JS + React混在で段階的に移行 | リスク最小化、移行途中でもデプロイ可能 | 混在コードの複雑性、長期化リスク | UI層のDOM操作パターンが段階的移行に不向き |
| Option B: 完全書き換え | 新規Vite+Reactプロジェクトを別ディレクトリに構築 | クリーンなコード、ベストプラクティス適用 | 初期工数大、並行メンテナンス | ビジネスロジック再利用可能だがディレクトリ分離のオーバーヘッド |
| **Option C: ビジネスロジック再利用 + UI新規構築** | 同一ディレクトリ内にsrc/を追加、ロジック層コピー再利用 | ディレクトリ変更最小、ロジック60-70%再利用、デプロイ影響最小 | public/旧コードとsrc/新コード共存 | **採用** |

## Design Decisions

### Decision: アーキテクチャアプローチ
- **Context**: Vanilla JS → React移行で段階的移行/完全書き換え/ハイブリッドの3択
- **Alternatives Considered**:
  1. Option A: 段階的移行 — DOM操作パターンがReactと混在しにくい
  2. Option B: 完全書き換え — ディレクトリ分離のオーバーヘッドが不要
- **Selected Approach**: Option C（ビジネスロジック再利用 + UI新規構築）
- **Rationale**: ビジネスロジック層（csv-transformer, index-merger, blob-writer, data-fetcher）がフレームワーク非依存で設計されており再利用可能。UI層はDOM直接操作が多く段階的移行のメリットが薄い
- **Trade-offs**: public/旧コードとsrc/新コードが共存するが、移行完了後にpublic/js/を削除することで解消
- **Follow-up**: 移行完了後にpublic/js/、public/lib/の旧コードを削除するクリーンアップタスク

### Decision: 状態管理アプローチ
- **Context**: FileQueueManagerの複雑な状態遷移（pending→validating→ready→saving→saved/save_failed）をReactでどう管理するか
- **Alternatives Considered**:
  1. useReducer — React標準、追加依存なし、複雑な状態遷移に適合
  2. Zustand — 軽量外部ライブラリ、ボイラープレート少ない
  3. XState — 状態マシンライブラリ、形式的だが学習コスト高い
- **Selected Approach**: useReducer + Context API
- **Rationale**: 追加依存を最小限に抑える方針。ファイルキューの状態遷移はuseReducerのdispatchパターンで明確に表現可能。アプリ全体の状態がシンプル（認証状態のみグローバル）なため外部ライブラリは不要
- **Trade-offs**: Zustandより冗長だが、React標準APIのみで完結する利点がある
- **Follow-up**: useReducerで複雑になりすぎる場合はZustandへの移行を検討

### Decision: ルーティングライブラリ
- **Context**: 既存のハッシュベースルーティングをReact対応にする
- **Alternatives Considered**:
  1. React Router v7 createHashRouter — データルーターAPI対応、公式推奨
  2. React Router v7 HashRouterコンポーネント — v6互換の宣言的API
  3. 自作ハッシュルーター — 依存なし、軽量
- **Selected Approach**: React Router v7 createHashRouter
- **Rationale**: 公式推奨API。将来のloader/action対応の拡張性。キャッチオールルート（`path="*"`）が標準サポート
- **Trade-offs**: 2ルートのみの小規模アプリにはオーバースペックだが、標準的なルーティングパターンで可読性が高い
- **Follow-up**: なし

### Decision: テストフレームワーク構成
- **Context**: 既存のVitest + jsdomテストをReact対応にしつつ、Playwright E2Eを追加
- **Alternatives Considered**:
  1. Vitest + React Testing Library + Playwright（分離構成）
  2. Playwright単体（E2E + コンポーネントテスト）
- **Selected Approach**: Vitest + React Testing Library（ユニット/統合） + Playwright（E2E）
- **Rationale**: 既存のVitest環境を活用。ロジック層テストはそのまま流用可能。UIテストはReact Testing Libraryで宣言的に記述。E2EはPlaywrightで実ブラウザ検証
- **Trade-offs**: テストツールが2種になるが、責務が明確に分離される
- **Follow-up**: vitest.setup.jsにwebcryptoポリフィルとReact Testing Libraryのcleanup設定を追加

## Risks & Mitigations
- AdminPanelの複雑な状態管理（390行） — useReducerで状態遷移を明示的に定義し、状態遷移図をコンポーネント設計に含める
- FileQueueの非同期パース→UI更新の競合 — Reactの状態管理（setState→再レンダリング）で自然に解決
- Deploy-StaticFiles.ps1との互換性 — build.outDir設定で出力先を調整、スクリプト側のパス変更は最小限
- crypto.subtleのテスト環境互換性 — vitest.setup.jsでNode.js webcryptoポリフィルを適用

## References
- [React Router v7 HashRouter API](https://reactrouter.com/api/declarative-routers/HashRouter) — HashRouterの公式ドキュメント
- [createHashRouter API](https://api.reactrouter.com/v7/functions/react_router.createHashRouter.html) — データルーターAPI
- [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) — ViteのReactプラグイン
- [papaparse npm](https://www.npmjs.com/package/papaparse) — CSV解析ライブラリ
- [Vitest crypto.subtle issue](https://github.com/vitest-dev/vitest/issues/5365) — jsdom環境でのcrypto.subtle問題
- [Playwright webServer設定](https://playwright.dev/docs/test-webserver) — E2Eテスト+開発サーバー連携
- [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) — Playwright MCPサーバー
