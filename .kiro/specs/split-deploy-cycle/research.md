# Research & Design Decisions

## Summary
- **Feature**: `split-deploy-cycle`
- **Discovery Scope**: Simple Addition
- **Key Findings**:
  - `public/` 配下の13ファイル中8ファイル（62%）が `data/` のJSONデータで、デプロイ時に毎回上書きされる
  - PowerShellの `Where-Object` で相対パスベースのフィルタリングが最もシンプルかつ確実
  - `src/` ディレクトリには `data/` が存在しないため影響なし

## Research Log

### public/ 配下のファイル構成調査
- **Context**: デプロイ除外対象の特定
- **Findings**:
  - アプリケーションファイル（5件）: `index.html`, `css/style.css`, `js/main.js`, `lib/papaparse.min.js`, `lib/papaparse-esm.js`
  - データファイル（8件）: `data/index.json`, `data/items/item-001.json` ～ `item-007.json`
  - データファイルはすべて `data/` プレフィックスを持つ
- **Implications**: `data/` プレフィックスで一括除外可能

### PowerShellフィルタリング方式の検討
- **Context**: `Get-ChildItem` の結果からファイルを除外する方法
- **Sources Consulted**: PowerShell `Where-Object`, `-Exclude` パラメータの仕様
- **Findings**:
  - `Get-ChildItem -Exclude` はファイル名のみ対応し、ディレクトリパスでの除外に不向き
  - `Where-Object` で相対パスを計算し `-notlike "data/*"` とするのが最も明確
- **Implications**: 相対パス計算ロジックは既存の Blob 名生成ロジック（111-112行目）と同じ手法を再利用可能

## Design Decisions

### Decision: Where-Object による相対パスフィルタリング
- **Context**: `data/` ディレクトリをデプロイ対象から除外する必要がある
- **Alternatives Considered**:
  1. `Get-ChildItem -Exclude` — ディレクトリパスに非対応
  2. `SourcePaths` から `data/` を別エントリで管理 — 過剰な設計変更
  3. `Where-Object` + 相対パス + `-notlike` — シンプルかつ既存パターン踏襲
- **Selected Approach**: Option 3（`Where-Object` による除外フィルタ）
- **Rationale**: 既存のBlob名生成と同じ相対パス計算を再利用でき、変更箇所が最小限
- **Trade-offs**: ハードコードされた除外パターンだが、現時点では `data/` のみで十分

## Risks & Mitigations
- 将来 `data/` 以外の除外が必要になった場合 → 除外パターンを配列化して拡張可能（現時点では不要）
