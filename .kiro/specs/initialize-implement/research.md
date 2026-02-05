# Research & Design Decisions

---
**Purpose**: initialize-implement機能のディスカバリー結果を記録する。
---

## Summary
- **Feature**: `initialize-implement`
- **Discovery Scope**: Extension（既存システムへの拡張）
- **Key Findings**:
  - `main.js`のESモジュールimportパスが`../src/`を参照しているが、`Deploy-StaticFiles.ps1`は`public/`配下のみをデプロイしており、`src/`がBlob上に存在しないためモジュール読み込みが失敗する
  - 既存のダミーデータ（3件）はJSON構造として正しいが、デプロイフローが不完全なためブラウザで検証できていない
  - PapaParseはCDN版（`lib/papaparse.min.js`）がグローバルスクリプトとして読み込まれるが、`csv-transformer.js`はES Module形式の`import Papa from 'papaparse'`を使用しており、ブラウザ上ではモジュール解決が失敗する

## Research Log

### ESモジュールのimportパス解決
- **Context**: ダッシュボードがトップ画面で表示されない原因調査
- **Sources Consulted**: `public/js/main.js`のimportパス、`Deploy-StaticFiles.ps1`のアップロード対象、ディレクトリ構造
- **Findings**:
  - `main.js`のimport: `import { AuthManager } from '../src/core/auth-manager.js'`
  - ブラウザ上のパス解決: `js/main.js` → `../src/core/auth-manager.js` → `src/core/auth-manager.js`（サイトルート基準）
  - `Deploy-StaticFiles.ps1`は`frontend/dashboard/public/`のみをアップロード
  - `src/`ディレクトリは`frontend/dashboard/src/`に存在するが、Blobにデプロイされていない
- **Implications**: `src/`ディレクトリもBlobにデプロイする必要がある。デプロイスクリプトの修正またはデプロイ手順の拡張が必要

### PapaParseのモジュール解決
- **Context**: `csv-transformer.js`のブラウザ上での動作検証
- **Sources Consulted**: `lib/papaparse.min.js`の読み込み方法、`csv-transformer.js`のimport文
- **Findings**:
  - `index.html`はグローバルスクリプトとして`<script src="lib/papaparse.min.js">`で読み込み
  - `csv-transformer.js`は`import Papa from 'papaparse'`（bare specifier）でインポート
  - ブラウザのESモジュールはbare specifierを解決できない（Import Mapが必要）
  - テスト環境（Vitest）ではNode.jsのモジュール解決でPapaParseパッケージを解決可能
- **Implications**: ブラウザ上で`csv-transformer.js`を動作させるにはImport Mapの追加、またはグローバル変数`Papa`への参照に変更が必要。ただし管理者機能（CSVインポート）は今回のスコープ外

### 既存ダミーデータの評価
- **Context**: 現在デプロイ済みのデータが検証に十分か確認
- **Sources Consulted**: `data/index.json`、`data/items/item-001.json` 〜 `item-003.json`
- **Findings**:
  - 3件のアイテム（月次売上・週次アクセス・在庫ステータス）が存在
  - JSON構造は`DashboardView`/`DetailView`が期待する形式に準拠
  - `index.json`の`items`配列と個別`items/{id}.json`の対応関係が正しい
- **Implications**: データ構造自体は問題ない。件数を5件以上に増やし、バリエーションを持たせることで検証の網羅性を向上させる

## Design Decisions

### Decision: src/ディレクトリのデプロイ方法
- **Context**: `main.js`のimportが`src/`配下を参照しており、Blob上にデプロイが必要
- **Alternatives Considered**:
  1. `Deploy-StaticFiles.ps1`を修正して`src/`も含める — デプロイスクリプト変更が必要
  2. `src/`を`public/src/`にコピーするビルドステップを追加 — ファイル重複・同期が面倒
  3. az cliで`public/`と`src/`を個別にデプロイ — スクリプト修正不要で即座に検証可能
- **Selected Approach**: az cliで`public/`と`src/`を個別にデプロイし、`Deploy-StaticFiles.ps1`のSourcePathパラメータも拡張
- **Rationale**: 既存スクリプトの即座の検証にはaz cliで対応し、恒久対策としてスクリプトを改修する
- **Trade-offs**: 一時的にaz cliとスクリプトの2重管理になるが、検証を即座に開始できる
- **Follow-up**: `Deploy-StaticFiles.ps1`のSourcePath拡張を実装タスクに含める

### Decision: PapaParseのImport Map対応
- **Context**: `csv-transformer.js`のbare specifierがブラウザで解決できない
- **Selected Approach**: 今回のスコープは閲覧フロー（ダッシュボード・ドリルダウン）の検証が主目的。管理者機能（CSVインポート）は動作しなくても許容する。Import Map対応は将来タスクとする
- **Rationale**: 管理者機能は今回の検証スコープ外。閲覧フローのみに集中する
- **Follow-up**: 管理者フロー検証時にImport Map追加を対応

## Risks & Mitigations
- **R1**: ネットワークファイアウォール（defaultAction=Deny）によりaz cliからのデプロイが失敗する可能性 → 前回設定済みのCIDR /16ルールが有効であることを前提とする。失敗時はIPルールを追加
- **R2**: ESモジュールのimportパスが実際のBlob構造と一致しない可能性 → デプロイ後にcurlで各ファイルの存在を確認するステップを含める
- **R3**: ブラウザキャッシュにより古いデータが表示される可能性 → `DataFetcher.fetchIndex()`がキャッシュバスター付き（`?v={timestamp}`）であるため低リスク

## References
- Azure Blob Storage静的サイトホスティング — `$web`コンテナのパス構造
- ES Modules in browsers — bare specifierの制約とImport Maps仕様
