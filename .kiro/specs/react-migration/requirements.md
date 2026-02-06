# Requirements Document

## Introduction
本プロジェクトは、Azure Blob Storage上の静的サイトとして運用されている学習管理ダッシュボードのフロントエンドを、現在のVanilla JavaScript（ES Modules）からReactベースのアーキテクチャへ移行するものである。既存の機能（ダッシュボード表示、メンバー詳細ドリルダウン、管理者向けCSVインポート、SASトークン認証）を維持しつつ、コンポーネント化・状態管理の改善・開発体験の向上を実現する。

現在のアーキテクチャは12個のES Moduleで構成され、ハッシュベースルーティング、DOMを直接操作するUI描画、Azure Blob Storageへの読み書きを行っている。既存の87件のテスト（Vitest + jsdom）によるカバレッジを維持しつつ、React Testing Libraryベースのテストへ移行する。さらに、Playwright MCPを活用したE2Eテストを新規導入し、ブラウザ上での実際のユーザー操作フローを自動検証する。

## Requirements

### Requirement 1: ビルド環境とプロジェクト構成の整備
**Objective:** As a 開発者, I want Reactベースのビルドパイプラインが整備されていること, so that 開発・ビルド・デプロイのワークフローが効率的に回ること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall Viteをビルドツールとして使用し、開発サーバーとプロダクションビルドの両方をサポートすること
2. The フロントエンドアプリケーション shall React 19以降およびReact DOMを本番依存パッケージとして含むこと
3. The フロントエンドアプリケーション shall ビルド成果物を `public/` ディレクトリに出力し、既存のAzure Blob Storageデプロイスクリプトとの互換性を維持すること
4. The フロントエンドアプリケーション shall TypeScriptを導入せず、JavaScriptのままReact（JSX）で記述すること
5. The フロントエンドアプリケーション shall PapaParseライブラリを引き続きCSV解析に使用すること

### Requirement 2: Reactコンポーネントへの移行
**Objective:** As a 開発者, I want 既存のUI描画ロジックがReactコンポーネントとして再実装されていること, so that 宣言的UIによる保守性・拡張性が向上すること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall DashboardViewをReactコンポーネントとして再実装し、勉強会一覧とメンバー一覧を表示すること
2. The フロントエンドアプリケーション shall DetailView（メンバー詳細画面）をReactコンポーネントとして再実装し、セッション参加履歴を表示すること
3. The フロントエンドアプリケーション shall AdminPanel（管理者パネル）をReactコンポーネントとして再実装し、CSVファイルのインポート・プレビュー・保存機能を提供すること
4. The フロントエンドアプリケーション shall FileQueueManager（ファイルキュー管理）をReactコンポーネントとして再実装すること
5. The フロントエンドアプリケーション shall DOM直接操作（innerHTML、createElement等）を使用せず、ReactのJSXによる宣言的UIで描画すること

### Requirement 3: ルーティングの移行
**Objective:** As a ユーザー, I want 画面遷移がReactベースのルーティングで動作すること, so that SPAとしてシームレスな画面遷移が維持されること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall React Routerを使用し、ハッシュベースのルーティングを提供すること
2. When ユーザーがルートURL（`#/`）にアクセスした場合, the フロントエンドアプリケーション shall ダッシュボード画面を表示すること
3. When ユーザーが `#/members/<id>` にアクセスした場合, the フロントエンドアプリケーション shall 該当メンバーの詳細画面を表示すること
4. When 管理者モードが有効な場合, the フロントエンドアプリケーション shall 管理者パネルへのナビゲーションを提供すること
5. If 存在しないルートにアクセスされた場合, the フロントエンドアプリケーション shall ダッシュボード画面にリダイレクトすること

### Requirement 4: 認証・認可機能の維持
**Objective:** As a 管理者, I want SASトークンによる認証が引き続き機能すること, so that 管理者機能へのアクセス制御が維持されること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall URLクエリパラメータからSASトークンを抽出し、管理者モードの判定を行うこと
2. While 管理者モードが無効な場合, the フロントエンドアプリケーション shall 管理者パネルを非表示にすること
3. While 管理者モードが有効な場合, the フロントエンドアプリケーション shall CSVインポートおよびデータ書き込み機能を有効化すること
4. The フロントエンドアプリケーション shall AuthManagerのロジックをReactのContext APIまたはカスタムHookとして提供すること

### Requirement 5: データ取得・書き込み機能の維持
**Objective:** As a ユーザー, I want データの取得と書き込みが正常に動作すること, so that ダッシュボードデータの閲覧とCSVインポートが引き続き利用できること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall DataFetcherの機能（index.json取得、セッション詳細取得、キャッシュバスター制御）をReact対応のデータ取得層として提供すること
2. The フロントエンドアプリケーション shall BlobWriterの機能（Azure Blob StorageへのPUT操作、リトライ機能）を維持すること
3. The フロントエンドアプリケーション shall IndexMergerの機能（index.jsonマージ、重複検出）を維持すること
4. The フロントエンドアプリケーション shall CsvTransformerの機能（CSV→JSON変換、UTF-16LE対応）を維持すること
5. While データ読み込み中, the フロントエンドアプリケーション shall ローディング状態をUIに表示すること
6. If データ取得に失敗した場合, the フロントエンドアプリケーション shall エラーメッセージをユーザーに表示すること

### Requirement 6: UI/UXの維持と改善
**Objective:** As a ユーザー, I want 既存のUIデザインとユーザー体験が維持されていること, so that 移行後も違和感なくアプリケーションを利用できること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall 既存のCSSスタイル（Material Design風カラースキーム、レスポンシブ対応）を維持すること
2. The フロントエンドアプリケーション shall ドラッグ&ドロップによるファイルアップロード機能を維持すること
3. The フロントエンドアプリケーション shall プログレスバーによる処理進捗表示を維持すること
4. The フロントエンドアプリケーション shall モバイル端末（max-width: 960px）での表示に対応すること

### Requirement 7: テストの移行
**Objective:** As a 開発者, I want 既存のテストカバレッジがReactベースのテストで維持されていること, so that コードの品質と信頼性が保証されること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall VitestをテストフレームワークとしてReactコンポーネントのテストに使用すること
2. The フロントエンドアプリケーション shall React Testing Libraryを使用し、UIコンポーネントのテストを記述すること
3. The フロントエンドアプリケーション shall ロジック層（CsvTransformer、IndexMerger等）のユニットテストを維持すること
4. The フロントエンドアプリケーション shall 統合テスト（管理者フロー、閲覧フロー）をReactコンポーネントベースで再実装すること
5. When `npm test` を実行した場合, the フロントエンドアプリケーション shall すべてのテストが成功すること

### Requirement 8: デプロイ互換性の維持
**Objective:** As a 運用管理者, I want 既存のデプロイパイプラインが引き続き利用できること, so that 運用上の変更を最小限に抑えられること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall ビルド成果物がAzure Blob Storageの`$web`コンテナに配置可能な静的ファイルであること
2. The フロントエンドアプリケーション shall 既存のDeploy-StaticFiles.ps1スクリプトとの互換性を維持すること（出力ディレクトリの調整のみ許容）
3. The フロントエンドアプリケーション shall `data/` ディレクトリ配下のJSONデータ構造に変更を加えないこと
4. The フロントエンドアプリケーション shall サーバーサイドレンダリングを必要とせず、静的ファイル配信のみで動作すること

### Requirement 9: Playwright E2Eテストの導入
**Objective:** As a 開発者, I want ブラウザ上での実際のユーザー操作を検証するE2Eテストが整備されていること, so that ユニットテストでは検出できないUI統合上の不具合を早期に発見できること

#### Acceptance Criteria
1. The フロントエンドアプリケーション shall Playwright MCPを活用し、ブラウザベースのE2Eテストを実行できること
2. The フロントエンドアプリケーション shall ダッシュボード画面の表示（勉強会一覧・メンバー一覧の描画）をE2Eテストで検証すること
3. When ダッシュボードからメンバーをクリックした場合, the E2Eテスト shall 詳細画面への遷移と内容表示を検証すること
4. When 管理者モード（SASトークン付きURL）でアクセスした場合, the E2Eテスト shall 管理者パネルの表示とCSVインポートフローを検証すること
5. The フロントエンドアプリケーション shall Viteの開発サーバーを起動した状態でE2Eテストを実行するnpmスクリプトを提供すること
6. The フロントエンドアプリケーション shall E2Eテストをヘッドレスモードで実行可能とし、CI環境での自動実行に対応すること
7. If E2Eテストが失敗した場合, the Playwright shall スクリーンショットとトレースを保存し、デバッグを容易にすること
