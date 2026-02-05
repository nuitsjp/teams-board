# Implementation Plan

> **スコープ**: 閲覧・更新アーキテクチャの確立。ダッシュボードの表示内容・データ構造は仮実装とし、次回の要件追加時に見直す。テストデータはすべて仮で作成する。

> **TDD方針（t_wada式）**: すべての実装タスクは以下のサイクルを厳守する。
> 1. **TODOリスト**: 実装前にテストケースの一覧を書き出す
> 2. **Red**: 失敗するテストを1つ書く
> 3. **Green**: そのテストを通す最小限のコードを書く（仮実装 → 三角測量 → 明白な実装）
> 4. **Refactor**: テストが通る状態を保ちながらコードを整理する
> 5. TODOリストの次の項目へ戻る
>
> テストを書かずにプロダクションコードを書いてはならない。1つのテストにつき1つの振る舞いのみを検証する。

- [x] 1. プロジェクト骨格とテスト基盤の構築
- [x] 1.1 プロジェクトのディレクトリ構成・テストランナー・仮テストデータを一括で準備する
  - `$web` コンテナ配置を前提としたHTML・JS・CSSの基本ファイルを配置する
  - ES Modulesによるモジュール分割の基盤を整える
  - PapaParse v5.x をローカルファイルとして配置する（CDN不使用、閉域環境対応）
  - Vitest をdevDependencyとして導入し、ES Modulesのテスト実行環境を構築する
  - jsdom環境を設定し、DOM操作のテストを可能にする
  - fetch APIのモック基盤（vi.fn / vi.stubGlobal）を用意する
  - テストのスモークテスト（サンプルテストの実行確認）を行う
  - 仮の `data/index.json`（3〜5件）、`data/items/<id>.json`（2〜3件）、テスト用CSVファイルを作成する
  - データ構造は設計のDashboardIndex / DashboardItem / ItemDetail に準拠するが、フィールド内容は仮とする
  - _Requirements: 8.1, 8.2, 1.1, 2.1_

- [x] 2. AuthManager の TDD実装
- [x] 2.1 AuthManagerのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - `token`パラメータ付きURLからSASトークンを抽出できること
    - `token`パラメータがないURLではnullを返すこと
    - トークン抽出後に `isAdminMode()` が true を返すこと
    - トークンなしの場合に `isAdminMode()` が false を返すこと
    - `initialize()` 後に `history.replaceState` でURLからtokenが除去されること
    - `getSasToken()` で保持中のトークンを取得できること
  - Red: 「tokenパラメータ付きURLからSASトークンを抽出できること」の失敗テストを書く
  - Green: 仮実装（ハードコードされた値を返す）→ 三角測量（複数のURL形式で検証）→ 明白な実装
  - Refactor: URLSearchParamsの利用箇所を整理し、TODOリストの次へ進む
  - 全TODOリスト完了後、history.replaceState のモックを使ったテストも含め全テストがGreenであることを確認する
  - _Requirements: 3.1, 3.2_

- [x] 3. Router の TDD実装
- [x] 3.1 (P) RouterのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - `#/` のハッシュから `{ view: "dashboard" }` ルートを取得できること
    - `#/items/abc` のハッシュから `{ view: "detail", itemId: "abc" }` ルートを取得できること
    - ハッシュなしの場合にデフォルトでダッシュボードルートを返すこと
    - `navigate()` でハッシュが変更されること
    - `onRouteChange` コールバックがルート変更時に呼び出されること
    - `hashchange` イベントでコールバックが発火すること
  - Red: 「`#/` のハッシュからdashboardルートを取得」の失敗テストから開始
  - Green: 仮実装で固定値を返す → 三角測量で `#/items/<id>` パターンを追加 → 明白な実装でハッシュパーサーを完成
  - Refactor: ルート解析ロジックの責務を整理する
  - _Requirements: 2.2_

- [x] 4. DataFetcher の TDD実装
- [x] 4.1 DataFetcherのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - `fetchIndex()` が `data/index.json` にキャッシュバスター付きでリクエストすること
    - `fetchIndex()` 成功時に `{ ok: true, data: DashboardIndex }` を返すこと
    - `fetchIndex()` 失敗時に `{ ok: false, error: string }` を返すこと
    - `fetchItem(id)` が `data/items/<id>.json` にキャッシュバスターなしでリクエストすること
    - `fetchItem(id)` 成功時に `{ ok: true, data: ItemDetail }` を返すこと
    - `fetchItem(id)` 失敗時に `{ ok: false, error: string }` を返すこと
    - ネットワークエラー（fetch例外）時に適切なエラー結果を返すこと
  - Red: fetchをモックし「fetchIndex がキャッシュバスター付きURLでリクエストする」の失敗テストから開始
  - Green: 仮実装でfetch呼び出しを書く → 三角測量でレスポンス解析を追加 → 明白な実装で結果型を完成
  - Refactor: fetchIndex/fetchItemの共通ロジックを抽出する
  - キャッシュバスター有無の差異を明示的にテストし、itemsが不変リソースとして扱われることを検証する
  - _Requirements: 1.1, 1.4, 2.1, 2.3, 6.1, 6.2_

- [x] 5. IndexMerger の TDD実装
- [x] 5.1 (P) IndexMergerのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 空のindexに新規アイテムを追加できること
    - 既存アイテムがあるindexに新規アイテムを追加できること
    - マージ後の`updatedAt`が現在時刻に更新されていること
    - 重複IDが検出された場合に警告を含む結果を返すこと
    - 新規アイテムが空配列の場合にupdatedAtのみ更新されること
    - 元のindexオブジェクトが変更されないこと（イミュータブル）
  - Red: 「空のindexに新規アイテムを追加」の失敗テストから開始
  - Green: 仮実装で固定配列を返す → 三角測量で既存アイテムありケースを追加 → 明白な実装で配列結合ロジックを完成
  - Refactor: イミュータブルな操作を保証し、重複チェックロジックを整理する
  - _Requirements: 5.2_

- [x] 6. CsvTransformer の TDD実装
- [x] 6.1 CsvTransformerのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 正常なCSV文字列をパースしてDashboardItem配列を生成できること
    - 正常なCSV文字列をパースしてItemDetail配列を生成できること
    - 各DashboardItemにユニークなidが付与されること
    - 空のCSVファイルでエラー結果を返すこと
    - ヘッダーのみ・データ行なしのCSVでエラー結果を返すこと
    - 不正なCSV（区切り文字不一致等）でパースエラーの詳細を返すこと
    - PapaParseのWeb Workerモードで実行されること（UIスレッド非ブロック）
  - Red: 「正常なCSVからDashboardItem配列を生成」の失敗テストから開始（PapaParseの呼び出しをモック）
  - Green: 仮実装で固定の変換結果を返す → 三角測量で複数行CSVの変換を追加 → 明白な実装でマッピングルールを完成
  - Refactor: パースロジックと変換ロジックの責務を分離する
  - マッピングルールは仮実装とし、次回の要件追加時に見直す
  - _Requirements: 4.1, 4.2, 4.4, 8.3_

- [x] 7. BlobWriter の TDD実装
- [x] 7.1 BlobWriterのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 単一ファイルのPUTリクエストが正しいURL・ヘッダーで送信されること
    - SASトークンがURLクエリパラメータとして付与されること
    - `x-ms-blob-type: BlockBlob` と `x-ms-version` ヘッダーが設定されること
    - 書き込み順序が raw → items → index の順であること
    - `data/index.json` のPUT直前に最新indexがGETで取得されること
    - 取得した最新indexに対してindexUpdater関数が呼び出されること
    - すべてのPUT成功時に `{ allSucceeded: true }` を返すこと
    - いずれかのPUT失敗時に失敗したパスとエラーを含む結果を返すこと
    - 最新index取得失敗時に書き込みシーケンス全体が中断されること
    - `retryFailed()` で失敗した操作のみ再実行されること
  - Red: fetchをモックし「単一ファイルのPUTが正しいURLで送信される」の失敗テストから開始
  - Green: 仮実装で固定のfetch呼び出しを書く → 三角測量でヘッダー検証を追加 → 明白な実装で書き込みシーケンスを完成
  - Refactor: 単一PUT操作とシーケンス制御の責務を分離する
  - 書き込み順序のテストではfetch呼び出しの順序をモックの呼び出し記録で検証する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.3, 7.1_

- [x] 8. UI Layer の TDD実装（閲覧系）
- [x] 8.1 DashboardViewのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - データ取得中にローディング表示がDOMに存在すること
    - データ取得成功後にアイテム一覧がDOMにレンダリングされること
    - 各アイテムがクリック可能な要素としてレンダリングされること
    - データ取得失敗時にエラーメッセージがDOMに表示されること
    - アイテムクリック時にRouterのnavigateが呼び出されること
  - Red: jsdom環境でDataFetcherをモックし「ローディング表示がDOMに存在する」の失敗テストから開始
  - Green: 仮実装で固定HTMLを挿入 → 三角測量でデータ依存のレンダリングを追加 → 明白な実装でfetch→render パイプラインを完成
  - Refactor: レンダリングロジックの共通化と状態管理を整理する
  - 一覧UIの表示内容・レイアウトは仮とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8.2 DetailViewのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 指定IDのアイテム詳細がDOMにレンダリングされること
    - データ取得失敗時にエラーメッセージと「一覧へ戻る」リンクが表示されること
    - 「戻る」操作でRouterのnavigateがdashboardルートで呼び出されること
  - Red: DataFetcherをモックし「アイテム詳細がDOMにレンダリングされる」の失敗テストから開始
  - Green: 仮実装 → 三角測量 → 明白な実装
  - Refactor: DashboardViewと共通のエラー表示パターンを抽出する
  - 詳細UIの表示内容・レイアウトは仮とする
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 9. UI Layer の TDD実装（管理系）
- [x] 9.1 管理者モード表示切替のTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 管理者モード有効時に管理者UIセクションがDOMに表示されること
    - 管理者モード無効時に管理者UIセクションがDOMに存在しないこと
    - AuthManagerの状態変化に応じてUIが切り替わること
  - Red: AuthManagerをモックし「管理者UI表示」の失敗テストから開始
  - Green: 仮実装 → 明白な実装
  - Refactor: 表示切替の条件分岐を整理する
  - _Requirements: 3.3, 3.4_

- [x] 9.2 CsvUploaderのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - ファイル選択UIがDOMに表示されること
    - Drag&Dropエリアがドロップイベントを受け付けること
    - ファイル投入時にCsvTransformerのparseが呼び出されること
    - パースエラー時にエラー詳細がDOMに表示されること
  - Red: CsvTransformerをモックし「ファイル投入でparseが呼び出される」の失敗テストから開始
  - Green: 仮実装 → 明白な実装
  - Refactor: イベントハンドラの責務を整理する
  - _Requirements: 4.1, 4.4_

- [x] 9.3 PreviewPanelと保存確定UIのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 変換結果がテーブル形式でDOMにプレビュー表示されること
    - 保存確定ボタンがDOMに表示されること
    - 保存確定ボタンクリック時にBlobWriterのexecuteWriteSequenceが呼び出されること
  - Red: BlobWriterをモックし「プレビューがテーブル形式で表示される」の失敗テストから開始
  - Green: 仮実装 → 明白な実装
  - Refactor: プレビューテーブルの生成ロジックを整理する
  - _Requirements: 4.3, 5.5_

- [x] 9.4 書き込み進捗・結果表示とリトライのTODOリストを作成し、Red→Green→Refactorで実装する
  - **TODOリスト**:
    - 書き込み処理中に進捗状態（ファイル名）がDOMに表示されること
    - 全PUT成功時に完了メッセージがDOMに表示されること
    - 一部失敗時に成功/失敗ファイルの一覧がDOMに表示されること
    - 失敗ファイルにリトライボタンがDOMに表示されること
    - リトライボタンクリックでBlobWriterのretryFailedが呼び出されること
  - Red: BlobWriterをモックし「進捗状態がDOMに表示される」の失敗テストから開始
  - Green: 仮実装 → 明白な実装
  - Refactor: 進捗表示と結果表示の状態管理を整理する
  - _Requirements: 5.5, 5.6, 7.1, 7.2, 7.3_

- [x] 10. 全体結合テスト
- [x] 10.1 閲覧フローの結合テストを実装・実行する
  - **TODOリスト**:
    - index.html初期表示 → index.json取得 → 一覧レンダリングの一連のフローが動作すること
    - アイテム選択 → ハッシュ変更 → 詳細画面表示のフローが動作すること
    - 詳細画面から「戻る」→ 一覧画面復帰のフローが動作すること
    - index.json取得失敗時のエラー表示フローが動作すること
  - 仮テストデータを使用した結合テストを書き、全コンポーネントが連携して正しく動作することを検証する
  - Red→Green→Refactorサイクルで結合テストを追加していく
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 6.1, 6.2_

- [x] 10.2 管理者フローの結合テストを実装・実行する
  - **TODOリスト**:
    - SAS付きURL → トークン取得 → 管理者UI表示のフローが動作すること
    - CSV投入 → パース → プレビュー表示のフローが動作すること
    - 保存確定 → raw PUT → items PUT → index GET → merge → index PUTの順序が正しいこと
    - PUT失敗時の進捗表示・リトライフローが動作すること
    - SASトークンなしでのアクセス時に管理者UIが非表示であること
  - fetchモックを使用し、Blobエンドポイントとの通信を含む結合テストを書く
  - Red→Green→Refactorサイクルで結合テストを追加していく
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.1, 7.2, 7.3, 8.3_

## Requirements Coverage

| Requirement | Task(s) |
|-------------|---------|
| 1.1 | 1.1, 4.1, 8.1, 10.1 |
| 1.2 | 8.1, 10.1 |
| 1.3 | 8.1, 10.1 |
| 1.4 | 4.1, 8.1, 10.1 |
| 2.1 | 1.1, 4.1, 8.2, 10.1 |
| 2.2 | 3.1, 8.2, 10.1 |
| 2.3 | 4.1, 8.2, 10.1 |
| 3.1 | 2.1, 10.2 |
| 3.2 | 2.1, 10.2 |
| 3.3 | 9.1, 10.2 |
| 3.4 | 9.1, 10.2 |
| 4.1 | 6.1, 9.2, 10.2 |
| 4.2 | 6.1, 10.2 |
| 4.3 | 9.3, 10.2 |
| 4.4 | 6.1, 9.2 |
| 5.1 | 7.1, 10.2 |
| 5.2 | 5.1, 7.1, 10.2 |
| 5.3 | 7.1, 10.2 |
| 5.4 | 7.1, 10.2 |
| 5.5 | 9.3, 9.4, 10.2 |
| 5.6 | 7.1, 9.4, 10.2 |
| 5.7 | 7.1, 10.2 |
| 6.1 | 4.1, 10.1 |
| 6.2 | 4.1, 10.1 |
| 6.3 | 7.1, 10.2 |
| 7.1 | 7.1, 9.4, 10.2 |
| 7.2 | 9.4, 10.2 |
| 7.3 | 9.4, 10.2 |
| 8.1 | 1.1, 8.1, 10.1 |
| 8.2 | 1.1, 10.1 |
| 8.3 | 6.1, 10.2 |
