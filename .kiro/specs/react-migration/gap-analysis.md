# ギャップ分析: react-migration

## 1. 現状調査

### 1.1 キーファイル・モジュール構成

| ファイル | LOC | 責務 | React再利用性 |
|---------|-----|------|--------------|
| `main.js` | 47 | アプリ初期化・DI・ルーティング接続 | ❌ 全面書き換え |
| `core/auth-manager.js` | 50 | SASトークン抽出・管理者モード判定 | ✅ Hook化で再利用 |
| `core/router.js` | 48 | ハッシュベースルーティング | ❌ React Router置換 |
| `data/data-fetcher.js` | 38 | index.json/session JSON取得 | ✅ そのまま再利用 |
| `data/blob-writer.js` | 133 | Azure Blob PUT/リトライ | ✅ そのまま再利用 |
| `data/index-merger.js` | 79 | DashboardIndexマージ・重複検出 | ✅ そのまま再利用 |
| `logic/csv-transformer.js` | 253 | Teams CSV→JSON変換（UTF-16LE） | ✅ そのまま再利用 |
| `ui/dashboard-view.js` | 109 | トップ画面（グループ・メンバー一覧） | ❌ コンポーネント化 |
| `ui/detail-view.js` | 129 | メンバー詳細ドリルダウン | ❌ コンポーネント化 |
| `ui/admin-panel.js` | 390 | CSV投入UI・プレビュー・保存 | ❌ コンポーネント化 |
| `ui/file-queue-manager.js` | 186 | ファイルキュー・バリデーション | ⚠️ ロジック再利用可、状態管理は書き換え |
| `css/style.css` | 104 | 全スタイル定義 | ✅ そのまま再利用 |

**コードベース合計**: 約1,400行（コア）+ 約2,400行（テスト24ファイル・87件）

### 1.2 アーキテクチャパターン・規約

- **モジュール形式**: ES Modules（`import`/`export`）、`#` プライベートフィールド
- **依存注入**: コンストラクタ経由でインスタンスを渡す（main.jsで組み立て）
- **エラーハンドリング**: `{ ok: true, data }` / `{ ok: false, error }` パターン統一
- **非同期処理**: async/await + Promise.all（セッション並列取得）
- **テスト配置**: `tests/` ディレクトリにソースと同一構造でミラー
- **ビルドツール**: なし（public/に直接配置、ES Modulesネイティブ配信）

### 1.3 統合面・データモデル

- **データ取得**: `fetch` API → `data/index.json`（キャッシュバスター付き）、`data/sessions/<id>.json`
- **データ書き込み**: `fetch` PUT → Azure Blob Storage（SASトークン認証、`x-ms-blob-type: BlockBlob`）
- **認証**: URLクエリパラメータ `?token=<SAS>` → `history.replaceState`でURL消去
- **ルーティング**: `window.location.hash` + `hashchange`イベント
- **CSV解析**: PapaParse（public/lib/に静的配置、importmapでESM化）
- **ID生成**: `crypto.subtle.digest('SHA-256')` → 先頭8桁hex

---

## 2. 要件実現性分析

### 2.1 要件→既存資産マッピング

| 要件 | 既存資産 | ギャップ |
|------|---------|---------|
| Req1: ビルド環境 | ビルドツールなし（ES Modules直接配信） | **Missing**: Vite導入、React/ReactDOM追加、JSX変換設定 |
| Req2: Reactコンポーネント化 | dashboard-view, detail-view, admin-panel, file-queue-manager | **Missing**: 全UIモジュールのReactコンポーネント書き換え |
| Req3: ルーティング | router.js（独自実装） | **Missing**: React Router導入、HashRouter設定 |
| Req4: 認証 | auth-manager.js | **低ギャップ**: Context/Hook化のみ |
| Req5: データ取得・書き込み | data-fetcher, blob-writer, index-merger, csv-transformer | **低ギャップ**: ロジックそのまま再利用可 |
| Req6: UI/UX維持 | style.css（104行） | **低ギャップ**: CSSそのまま再利用 |
| Req7: テスト移行 | 87テスト（Vitest + jsdom） | **Missing**: React Testing Library導入、UIテスト書き換え |
| Req8: デプロイ互換性 | Deploy-StaticFiles.ps1 | **Constraint**: 出力ディレクトリ変更（dist/）のみ |
| Req9: Playwright E2E | なし | **Missing**: Playwright新規導入、E2Eテスト全面新規作成 |

### 2.2 複雑性シグナル

| 領域 | 複雑性 | 理由 |
|------|-------|------|
| ビジネスロジック層 | 低 | 純粋関数、フレームワーク非依存、テスト付き |
| UI描画層 | **高** | innerHTML + createElement混在、イベント手動バインド |
| AdminPanel状態管理 | **高** | FileQueueManager + AdminPanel間の状態分散、非同期パース→UI更新→保存の複合フロー |
| ルーティング | 低 | 2画面のみ（dashboard / memberDetail） |
| E2Eテスト | 中 | 新規構築、Vite devサーバー連携が必要 |

---

## 3. 実装アプローチ選択肢

### Option A: 段階的移行（Hybrid）

**概要**: 既存のVanilla JSコードベースにViteを導入し、段階的にReactコンポーネントへ置き換え

- **Phase 1**: Vite導入 + 既存コードをそのままバンドル
- **Phase 2**: ページ単位でReactコンポーネント化（dashboard → detail → admin）
- **Phase 3**: 全ページ移行後にrouter.js → React Router置換
- **Phase 4**: テスト移行 + E2E導入

**トレードオフ**:
- ✅ リスク最小化（既存機能を壊さず段階的に移行）
- ✅ 移行途中でもデプロイ可能
- ❌ 一時的にVanilla JS + React混在（コード複雑化）
- ❌ 移行期間が長期化する可能性

### Option B: 完全書き換え（New）

**概要**: Vite + Reactで新規プロジェクトを構築し、ビジネスロジック層をコピーして再利用

- ビジネスロジック（csv-transformer, index-merger, blob-writer, data-fetcher）はファイルコピーで再利用
- UIは全面React化（DashboardPage, MemberDetailPage, AdminPanel）
- テストも全面書き換え（React Testing Library）

**トレードオフ**:
- ✅ クリーンなコードベース（技術的負債なし）
- ✅ Reactのベストプラクティスを最初から適用可能
- ✅ ビジネスロジック60-70%再利用（コピー可能）
- ❌ 初期工数が大きい（全UI + テスト書き換え）
- ❌ 移行完了まで既存版とReact版が並行

### Option C: ビジネスロジック再利用 + UI新規構築

**概要**: Option Bと同様だが、同一ディレクトリ構造内でsrc/を追加

- `frontend/dashboard/src/` に新規Reactソースを配置
- `frontend/dashboard/public/js/` の既存ロジック（data/, logic/）をsrc/services/にコピー
- Viteビルド出力を `dist/` に配置し、Deploy-StaticFiles.ps1を調整

**トレードオフ**:
- ✅ 既存ディレクトリ構造を大きく変えない
- ✅ ビジネスロジック再利用を明確に分離
- ✅ デプロイスクリプトの変更が最小限
- ❌ public/（旧）とsrc/（新）が同一プロジェクト内に共存

---

## 4. リサーチ必要事項（設計フェーズで調査）

| 項目 | 理由 | 優先度 |
|------|------|-------|
| React Router v7のHashRouter対応状況 | React Router v7ではAPIが変更されている可能性 | 高 |
| Vite + PapaParseのバンドル設定 | 現在importmapで読み込み、Viteバンドルへの切り替え方法 | 高 |
| Playwright + Vite devサーバーの統合方法 | E2Eテスト実行時のサーバー起動・待機戦略 | 中 |
| `crypto.subtle`のVitest/jsdom互換性 | SHA-256ハッシュ生成がテスト環境で動作するか | 中 |
| Deploy-StaticFiles.ps1のdist/対応 | ビルド出力先変更時のスクリプト修正箇所 | 低 |

---

## 5. 実装複雑性・リスク評価

### 工数見積り

| 領域 | 工数 | 根拠 |
|------|------|------|
| ビルド環境整備（Vite + React） | S (1-2日) | 標準的なVite + Reactセットアップ |
| ビジネスロジック層移行 | S (1-2日) | ファイルコピー + import調整のみ |
| DashboardPage + DetailPage | M (3-4日) | DOM操作→JSX書き換え、データ取得Hook化 |
| AdminPanel + FileQueue | L (5-7日) | 複雑な状態管理、非同期フロー、プレビュー機能 |
| ルーティング（React Router） | S (1日) | 2ルートのみ |
| 認証（useAuth Hook） | S (1日) | 単純なContext/Hook変換 |
| テスト移行（Vitest + RTL） | M (3-4日) | UIテスト書き換え、ロジックテスト流用 |
| Playwright E2E新規構築 | M (3-4日) | 新規、3シナリオ（閲覧・遷移・管理者フロー） |
| デプロイ調整 | S (0.5日) | スクリプトのパス変更のみ |
| **合計** | **L (13-20日)** | |

### リスク評価

| リスク | レベル | 緩和策 |
|--------|-------|-------|
| AdminPanelの状態管理複雑性 | **高** | Zustand/useReducerで状態を一元化、状態遷移図を設計フェーズで作成 |
| FileQueueの非同期パース→UI更新の競合 | **高** | React状態管理で自然に解決（setState→再レンダリング） |
| PapaParseのViteバンドル互換性 | **中** | npm installでESM版を使用、importmap不要に |
| crypto.subtleのテスト環境対応 | **中** | Vitest設定でWeb Crypto APIポリフィル、または既存テストの対応確認 |
| Deploy-StaticFiles.ps1との互換性 | **低** | 出力ディレクトリ変更のみ |
| CSS互換性（className→className） | **低** | ReactではclassName属性で既存CSSクラスをそのまま使用可能 |

---

## 6. 推奨事項

### 推奨アプローチ: **Option C（ビジネスロジック再利用 + UI新規構築）**

**理由**:
1. ビジネスロジック層（csv-transformer, index-merger, blob-writer, data-fetcher）がフレームワーク非依存で設計されており、60-70%のコード再利用が見込める
2. UI層はDOM直接操作が多く段階的移行のメリットが薄い（混在コードの保守コスト > 書き換えコスト）
3. 既存ディレクトリ構造内での作業により、デプロイスクリプトの変更を最小限に抑えられる

### 設計フェーズへの引継ぎ事項
1. **AdminPanelの状態遷移設計**: FileQueueManagerの状態遷移（pending→validating→ready→saving→saved/save_failed）をReact状態管理でどう表現するか
2. **React Router設定**: HashRouterの具体的な設定とSASトークン認証との連携方法
3. **PapaParseのバンドル方式**: npm依存 vs 静的ファイル配置の決定
4. **Playwright E2Eの構成**: テストデータの準備方法、Vite devサーバーとの連携
5. **ディレクトリ構成の確定**: src/配下のフォルダ構成（hooks/, services/, components/, pages/）
