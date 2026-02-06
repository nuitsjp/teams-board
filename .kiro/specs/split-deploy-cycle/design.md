# Design Document: split-deploy-cycle

## Overview

**Purpose**: `Deploy-StaticFiles.ps1` のファイル取得処理に `data/` ディレクトリの除外フィルタを追加し、アプリケーションコードとデータのデプロイサイクルを分離する。

**Users**: 運用者がアプリコードのみを安全にデプロイできるようになる。

**Impact**: 既存の `Get-ChildItem` 呼び出しに `Where-Object` パイプラインを追加し、`data/` プレフィックスを持つファイルを除外する。

### Goals
- `Deploy-StaticFiles.ps1` 実行時に `data/` ディレクトリが自動的に除外される
- 既存のアプリケーションファイルのデプロイ動作に影響を与えない
- `src/` パスのデプロイに副作用がない

### Non-Goals
- データ専用のデプロイスクリプトの新規作成（将来対応）
- 除外パターンのパラメータ化（現時点では不要）

## Architecture

### Existing Architecture Analysis

`Deploy-StaticFiles.ps1` は以下の処理フローを持つ:

1. `SourcePaths` の各エントリをループ
2. `Get-ChildItem -Recurse -File` で全ファイルを取得
3. 相対パスからBlob名を生成
4. ファイルごとに `Set-AzStorageBlobContent` でアップロード

変更は手順2のファイル取得部分にフィルタを追加するのみ。

### Architecture Pattern & Boundary Map

**Architecture Integration**:
- Selected pattern: パイプラインフィルタ（PowerShellの `Where-Object` パイプライン）
- Existing patterns preserved: 相対パス計算ロジック（既存のBlob名生成と同一手法）
- New components rationale: 新規コンポーネントなし（既存パイプラインへのフィルタ追加のみ）

### Technology Stack

| Layer | Choice / Version | Role in Feature | Notes |
|-------|------------------|-----------------|-------|
| Infrastructure / Runtime | PowerShell 5.1+ / Az module | デプロイスクリプト実行環境 | 既存と同一 |

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1 | data/ 除外フィルタ | Deploy-StaticFiles.ps1 | Where-Object パイプライン | ファイル取得フロー |
| 1.2 | 非data/ ファイルの正常デプロイ | Deploy-StaticFiles.ps1 | 既存アップロード処理 | ファイル取得フロー |
| 1.3 | src/ パスへの影響なし | Deploy-StaticFiles.ps1 | 既存処理（変更なし） | src/ ループ |
| 1.4 | 説明コメントの更新 | Deploy-StaticFiles.ps1 | .DESCRIPTION セクション | — |

## Components and Interfaces

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies | Contracts |
|-----------|--------------|--------|--------------|------------------|-----------|
| Deploy-StaticFiles.ps1 | Infrastructure | Blobデプロイスクリプト | 1.1, 1.2, 1.3, 1.4 | Az PowerShell module (P0) | — |

### Infrastructure

#### Deploy-StaticFiles.ps1 (変更箇所)

| Field | Detail |
|-------|--------|
| Intent | ファイル取得時に `data/` ディレクトリを除外する |
| Requirements | 1.1, 1.2, 1.3, 1.4 |

**Responsibilities & Constraints**
- `Get-ChildItem` の結果を `Where-Object` でフィルタリングし、相対パスが `data/*` に一致するファイルを除外する
- 除外ロジックは `public/` ソースパスだけでなく全ソースパスに適用されるが、`src/` には `data/` が存在しないため実質影響なし
- ファイル数のカウントは `@($files).Count` で配列化して正確に取得する（パイプライン結果が単一要素の場合の対策）

**Implementation Notes**
- 相対パス計算: 既存の Blob 名生成ロジック（`$_.FullName.Substring(...)` + `Replace("\", "/")`) を再利用
- フィルタ条件: `-notlike "data/*"` でプレフィックスマッチ
- `.DESCRIPTION` セクションに除外理由を1行追記

## Testing Strategy

### 手動検証
- デプロイ実行後、アップロードされたファイル一覧に `data/` が含まれないことを確認
- `index.html`, `css/style.css`, `js/main.js`, `lib/*` が正常にアップロードされることを確認
- Blob上の既存 `data/` ファイルが影響を受けないことを確認
