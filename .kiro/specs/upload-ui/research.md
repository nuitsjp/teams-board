# リサーチ & 設計判断ログ

## サマリー
- **フィーチャー**: `upload-ui`
- **ディスカバリー範囲**: Extension（既存AdminPanelの拡張）
- **主要な発見事項**:
  - 既存AdminPanelは単一ファイル処理に限定されており、ファイルキュー管理の仕組みが存在しない
  - BlobWriter.executeWriteSequenceは逐次実行設計のため、複数ファイル一括保存はループ呼び出しで実現可能
  - IndexMergerは重複セッションID検出機能を持つため、プレビュー段階での重複チェックに再利用できる

## リサーチログ

### 既存AdminPanelの拡張ポイント分析
- **きっかけ**: 単一ファイル→複数ファイル対応への拡張方法を特定する必要がある
- **調査内容**: `src/ui/admin-panel.js`の構造分析
- **発見事項**:
  - AdminPanelはプライベートフィールド `#currentFile`, `#currentParseResult` で単一ファイル状態を管理
  - `#handleFile(file)` は1ファイルのみ処理する設計
  - `#renderPreview` は1件分のmergeInputのみ描画
  - `<input type="file">` に `multiple` 属性がない
- **設計への影響**: 状態管理をファイルキュー（配列）に変更し、描画ロジックをループ対応にリファクタリングが必要

### BlobWriterの複数ファイル対応可否
- **きっかけ**: 一括保存処理の実現方法を検討
- **調査内容**: `src/data/blob-writer.js`のインターフェース分析
- **発見事項**:
  - `executeWriteSequence` は `rawCsv`（1件）+ `newItems`（配列）+ `indexUpdater` で構成
  - 複数CSVの場合、各CSVごとに `executeWriteSequence` を呼び出す逐次実行が最も安全
  - `indexUpdater` は最新index.jsonを取得→マージなので、逐次呼び出しで整合性を維持できる
- **設計への影響**: BlobWriterのインターフェース変更は不要。AdminPanel側で逐次ループ実行する

### IndexMergerの重複検出機能
- **きっかけ**: プレビュー時の重複チェック要件への対応方法
- **調査内容**: `src/data/index-merger.js`のmergeロジック分析
- **発見事項**:
  - `merge()` は重複sessionIdを検出し、warningsに含めて返す（マージはスキップ）
  - ただし、merge()はindex全体を必要とするため、ブラウザ側で事前チェックするにはDataFetcherで最新indexを取得する必要がある
  - 別の方法として、sessionIdの生成ロジック（studyGroupId + date）をparse結果から取得し、既存index.jsonのsessionIdsと比較する軽量チェックも可能
- **設計への影響**: プレビュー段階では、DataFetcherで取得済みのindexとsessionIdを比較する軽量チェック方式を採用

### CSSアニメーション方針
- **きっかけ**: ドロップアニメーション要件（5.2）への対応方法
- **調査内容**: 既存CSSの構造確認
- **発見事項**:
  - 現在のCSSはシンプルなtransition（box-shadow, border-color）のみ
  - CSS Animationsと`@keyframes`でフェードイン・スライドインを実装可能
  - 外部ライブラリは不要（バニラCSS + CSSアニメーションで十分）
- **設計への影響**: `@keyframes`ベースのCSSアニメーションを追加。新規ライブラリは導入しない

## アーキテクチャパターン評価

| オプション | 説明 | 強み | リスク/制約 | 備考 |
|-----------|------|------|-----------|------|
| AdminPanel拡張 | 既存クラスにキュー管理とマルチファイルロジックを追加 | 変更最小限、既存パターン踏襲 | 単一クラスの肥大化 | 現時点では許容範囲 |
| FileQueueManager分離 | ファイルキュー管理を専用クラスに抽出 | 責務分離、テスト容易 | 過度な分離でコード量増加 | **採用**: 適切な責務分割 |

## 設計判断

### 判断: FileQueueManagerの導入
- **背景**: 複数ファイルの状態管理（追加・削除・状態遷移）はAdminPanelの描画責務とは異なる
- **検討した選択肢**:
  1. AdminPanel内に配列フィールドを追加 — シンプルだがクラス肥大化
  2. FileQueueManagerを新規クラスとして分離 — 責務分離、単体テスト容易
- **選択した方法**: FileQueueManagerを新規導入し、AdminPanelはUI描画に集中
- **理由**: 要件1〜4すべてがファイルキュー状態に依存しており、状態管理ロジックのテストを独立して行えるメリットが大きい
- **トレードオフ**: ファイル数が増えるが、各クラスの責務が明確になる
- **フォローアップ**: AdminPanel ↔ FileQueueManager間のイベント通知インターフェースをシンプルに保つ

### 判断: 重複チェック方式
- **背景**: プレビュー段階で既存セッションとの重複を検出する必要がある
- **検討した選択肢**:
  1. IndexMerger.mergeをdry-run実行 — 正確だが、index全体のfetch + mergeが必要
  2. sessionIdの文字列比較 — 軽量、DataFetcherの既存キャッシュを利用可能
- **選択した方法**: sessionId文字列比較方式
- **理由**: DashboardView描画時にDataFetcherが取得済みのindexをAdminPanelに渡すことで、追加通信なしで重複チェック可能
- **トレードオフ**: キャッシュ鮮度に依存するが、管理者操作中の短時間では実用上問題ない

## リスク & 軽減策
- **クラス肥大化リスク** — FileQueueManagerへの分離で軽減
- **逐次保存のパフォーマンス** — ファイル数が現実的（1-10件程度）であれば問題なし。プログレスバーで体感速度を改善
- **CSSアニメーションの互換性** — モダンブラウザ限定のため問題なし（IE非対応）

## 参考資料
- 既存ソースコード: `src/ui/admin-panel.js`, `src/data/blob-writer.js`, `src/data/index-merger.js`, `src/logic/csv-transformer.js`
- HTML5 File API: ドラッグ&ドロップ、FileList、multiple属性
- CSS Animations: `@keyframes`, `animation`, `transition`
