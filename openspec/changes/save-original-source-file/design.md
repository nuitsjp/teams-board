## Context

現在の管理機能（AdminPage）では、Teams出席レポートCSVをアップロードすると以下の3つの書き込みが実行される：

1. `raw/{timestamp}-{filename}.csv` — 元CSVファイル（Fileオブジェクトをそのまま保存）
2. `data/sessions/{sessionId}.json` — 変換後のセッションデータ
3. `data/index.json` — ダッシュボード用インデックスの更新

このうち、1番の保存パスがタイムスタンプ＋元ファイル名ベースであるため、どのセッションに対応するファイルか特定しにくい。セッションIDベースのパスに変更して追跡可能性を向上させる。

変更対象は `AdminPage.jsx` の `handleBulkSave` 関数内で `rawCsv.path` を組み立てている1箇所のみ。`BlobWriter` 自体は汎用的な書き込み処理であり、パスを受け取って保存するだけなので変更不要。

## Goals / Non-Goals

**Goals:**

- ソースCSVの保存パスを `data/sources/{sessionId}.csv` に変更し、セッションJSONと一対一で対応させる
- 既存の `BlobWriter` のインターフェースを維持しつつ、パス変更のみで対応する

**Non-Goals:**

- 既に `raw/` に保存済みのファイルの移行・削除は行わない
- ソースファイルの閲覧・ダウンロード UI は本変更のスコープ外
- CSVの変換ロジック（`CsvTransformer`）への変更は行わない

## Decisions

### 1. 保存パスの命名規則: `data/sources/{sessionId}.csv`

**選択**: `data/sources/{sessionId}.csv`

**理由**:

- セッションJSON（`data/sessions/{sessionId}.json`）と同じID体系で対応するため、紐づけが明確
- `data/` 配下に統一することで、データの論理的な構造が一貫する
- sessionId はハッシュベースで一意性が保証されている

**代替案**:

- `raw/{sessionId}.csv` — `raw/` ディレクトリを継続使用する案。しかし `data/` 配下に統一した方がデータ構造として整合的
- `data/sessions/{sessionId}.csv` — sessions と同じディレクトリに置く案。JSON と CSV が混在し、管理が煩雑になるため不採用

### 2. 変更箇所の最小化

**選択**: `AdminPage.jsx` の `handleBulkSave` 内のパス文字列のみ変更

**理由**:

- `BlobWriter.executeWriteSequence` はパスを引数として受け取る汎用的な設計であり、内部の変更は不要
- `CsvTransformer` は CSV パースのみを担当し、保存先に関与しない
- タイムスタンプ生成コード（`new Date().toISOString().replace(...)`)は不要になるため削除

## Risks / Trade-offs

- **同一セッションの再アップロード**: 同じ勉強会・同じ日付のCSVを再アップロードした場合、同じ sessionId が生成されるため `data/sources/{sessionId}.csv` が上書きされる。ただし、セッションJSON（`data/sessions/{sessionId}.json`）も同様に上書きされるため、整合性は維持される。→ 既存の重複検出（`duplicate_warning` ステータス）で事前に警告されるため、実運用上の問題は小さい
- **既存 `raw/` データとの不整合**: 移行を行わないため、過去のデータは `raw/` に残り続ける。→ 新規アップロード分から `data/sources/` に保存されるため、段階的に移行される。必要に応じて手動で移行可能
