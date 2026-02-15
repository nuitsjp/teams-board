## Context

Issue #96 では、管理画面で保存が完了しても、ダッシュボードに戻った直後は更新前データが表示される。原因は `DashboardPage` が保持する `DataFetcher` インスタンスの `index.json` TTL キャッシュであり、30 秒以内の再表示ではネットワーク再取得が行われない点にある。  
一方 `AdminPage` は別インスタンスの `DataFetcher` を利用しているため、管理画面側で保存成功してもダッシュボード側キャッシュを無効化できない。  
既存仕様 `data-fetcher-cache` は TTL キャッシュと戻り値互換性を要求しており、今回の修正ではこの要件を維持したまま「保存後に最新データを即時反映できる制御」を追加する必要がある。

## Goals / Non-Goals

**Goals:**
- 管理画面で `index.json` 更新を伴う保存成功後、ダッシュボード再表示時に最新データを取得させる。
- 既存の `fetchIndex()` / `fetchSession()` の戻り値形式を変更しない。
- 既存の TTL キャッシュ（通常時の通信削減）を維持しつつ、必要時のみ明示的に破棄できるようにする。
- 変更範囲を `DataFetcher` と Admin/Dashboard 間の連携に限定し、構成変更を最小化する。

**Non-Goals:**
- 全ページ（Group/Member 詳細含む）の取得戦略を全面的に再設計すること。
- グローバル状態管理ライブラリの導入（Redux, Zustand など）。
- `session` JSON キャッシュ戦略の変更。
- TTL 値（30,000ms）の変更。

## Decisions

### 1. `DataFetcher` に index キャッシュ無効化 API を追加する

- 決定:
  - `DataFetcher` に `invalidateIndexCache()` を追加し、`index.json` キャッシュを明示的に破棄できるようにする。
  - 対象は index キャッシュのみとし、session キャッシュは維持する。
- 理由:
  - Issue の原因が index TTL キャッシュに限定されるため、影響範囲を最小化できる。
  - 既存の公開 API 互換性を保ちながら追加機能として導入できる。
- 代替案:
  - React Context による全面共有化: 将来拡張性はあるが、今回の不具合修正に対して変更規模が過大。
  - 画面遷移ごとの強制クリア: 実装は容易だが、正常ケースでも不要な再取得が発生する。

### 2. Admin と Dashboard は同一 `DataFetcher` インスタンスを利用する

- 決定:
  - 共有インスタンス（例: `sharedDataFetcher`）をサービス層で定義し、`AdminPage` と `DashboardPage` は同じインスタンスを参照する。
- 理由:
  - 「Admin で無効化 → Dashboard で再取得」の因果を同一キャッシュに対して保証できる。
  - クロスページ通知（イベントバス等）を追加せずに確実性を担保できる。
- 代替案:
  - インスタンス間で静的キャッシュ共有: 実現可能だが `DataFetcher` 実装の責務が増え、影響が読みづらくなる。
  - カスタムイベント通知: 受信タイミング依存があり、非表示ページで取りこぼす設計リスクがある。

### 3. 無効化タイミングは「index 更新成功直後」に限定する

- 決定:
  - `AdminPage` の以下処理で index 更新成功後に `invalidateIndexCache()` を呼ぶ。
    - CSV 一括保存（`data/index.json` 更新成功時）
    - グループ名保存（`index.json` 更新成功時）
- 理由:
  - 失敗時はキャッシュを維持した方が整合性が高い。
  - 成功時のみ無効化することで不要な再取得を避けられる。
- 代替案:
  - 保存開始時に先行無効化: 失敗時にもキャッシュが消えるため、再取得回数と UI ぶれが増える。

### 4. 管理画面内の再取得前にも明示無効化を行う

- 決定:
  - グループ名保存後に再取得する前に `invalidateIndexCache()` を実行し、管理画面内でも最新 index を取得する。
- 理由:
  - 現行実装では同一 TTL 内再取得で古い index を読む可能性がある。
  - Issue #96 の主訴はダッシュボード反映だが、同根の不整合を同時に抑止できる。

## Risks / Trade-offs

- [Risk] 共有インスタンス化によりページ間のキャッシュ状態が結合される  
  → Mitigation: 共有対象を Admin/Dashboard に限定し、公開 API と挙動をテストで固定する。

- [Risk] `invalidateIndexCache()` 呼び忘れにより再発する  
  → Mitigation: 保存系ハンドラごとのテスト（成功時に無効化呼び出し）を追加する。

- [Risk] 無効化直後の再取得失敗時に最新表示が遅延する  
  → Mitigation: 既存エラー表示を維持し、失敗レスポンス非キャッシュ要件で次回再取得可能性を確保する。

## Migration Plan

1. `DataFetcher` に `invalidateIndexCache()` を追加し、ユニットテストを先行追加する。  
2. 共有 `DataFetcher` 参照を導入し、`DashboardPage` / `AdminPage` で利用する。  
3. Admin の保存成功フロー（CSV 一括保存、グループ名保存）に無効化呼び出しを追加する。  
4. React テストで「保存後に最新データ取得」を検証する。  
5. 既存キャッシュ要件（TTL、戻り値互換）の回帰テストを実行する。  

ロールバックは、共有参照の導入を戻し、`invalidateIndexCache()` 呼び出しを除去すれば従来挙動に復帰できる。

## Open Questions

- 共有 `DataFetcher` を Group/Member 詳細画面にも適用するかは本変更のスコープ外とし、必要が出た時点で別 change で検討する。  
- `invalidateIndexCache()` の命名（`clearIndexCache` との比較）は実装時に既存命名規則との整合で最終確定する。
