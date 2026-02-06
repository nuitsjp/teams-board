# Research & Design Decisions

## Summary
- **Feature**: `local-real-data-conversion`
- **Discovery Scope**: Extension
- **Key Findings**:
  - 実データ入力は `data/sample/*.csv` に存在し、出力先 `frontend/dashboard/public/data/index.json` は依然としてダミーデータ構造（`items[]`）のまま。
  - 既存 `CsvTransformer` は Teams 出席レポート（UTF-16LE/TSV/3セクション）変換ロジックをすでに持つため、ローカル実行用アダプタを追加すれば再利用可能。
  - Node.js 20+ の標準API（`TextDecoder`, `crypto.subtle`, `fs/promises`）で要件を満たせるため、新規ライブラリ追加は不要。

## Research Log

### 既存拡張点と影響範囲
- **Context**: 既存アプリを壊さず、ローカル変換導線を追加するための変更境界を特定する必要があった。
- **Sources Consulted**:
  - `frontend/dashboard/src/logic/csv-transformer.js`
  - `frontend/dashboard/src/data/index-merger.js`
  - `frontend/dashboard/src/data/data-fetcher.js`
  - `frontend/dashboard/src/ui/dashboard-view.js`
  - `frontend/dashboard/src/ui/detail-view.js`
  - `frontend/dashboard/public/data/index.json`
  - `data/sample/*.csv`
- **Findings**:
  - 変換ロジックは `CsvTransformer.parse(file)` と `IndexMerger.merge(currentIndex, mergeInput)` に集約されている。
  - 閲覧側は `data/index.json` + `data/sessions/<sessionId>.json` 前提で動作する。
  - 既存 `public/data/index.json` は旧構造（`items[]`）で、現行UI契約と不整合。
- **Implications**:
  - ローカル変換は「CSV読込 → SessionRecord群生成 → DashboardIndexマージ生成 → `public/data` 置換」のバッチ境界で設計する。
  - 変換後の契約検証（必須項目、参照整合）が必須。

### Node.js 実行時の互換性確認
- **Context**: ブラウザ向け変換ロジックをローカルCLIで再利用できるかを確認した。
- **Sources Consulted**:
  - [Node.js API: Globals (`crypto`, `TextDecoder`)](https://nodejs.org/api/globals.html)
  - [Node.js API: Web Crypto](https://nodejs.org/api/webcrypto.html)
  - [Node.js API: `util.TextDecoder` encodings](https://nodejs.org/api/util.html)
- **Findings**:
  - Node.js は WHATWG `TextDecoder` を提供し、`utf-16le` を扱える。
  - `crypto.subtle.digest()` で `SHA-256` が利用可能。
  - Browser `File` 依存を直接持ち込まず、`arrayBuffer()` 契約を満たす入力アダプタにすればランタイム差異を吸収できる。
- **Implications**:
  - 共有インターフェースを `CsvSource`（`name`, `arrayBuffer()`）へ抽象化して Browser/Node 両対応にする。

### CSVパース依存の適合性確認
- **Context**: Teamsレポートの参加者セクション（TSV）を既存ライブラリで継続利用できるか確認した。
- **Sources Consulted**:
  - [PapaParse Documentation](https://www.papaparse.com/docs)
- **Findings**:
  - PapaParse は文字列入力の `parse` をサポートし、`delimiter: '\t'`, `header: true` 設定が可能。
  - 既存の参加者セクション抽出後パース方式を維持できる。
- **Implications**:
  - 変換フローは `CsvTransformer` を中核に据え、ローカルスクリプト側で前後処理（ファイル列挙・書き込み）のみ追加する。

### 置換時の完全性（partial write防止）
- **Context**: 要件 2.3（不完全置換を残さない）を満たすため、出力反映方法を検証した。
- **Sources Consulted**:
  - [Node.js API: `fsPromises.rename`](https://nodejs.org/api/fs.html)
- **Findings**:
  - 同一ボリューム内の `rename` を使ったディレクトリ切替で、段階的書き込みより中間状態露出を抑制できる。
  - 反映前に staging 出力を完了し、失敗時は公開ディレクトリを変更しない方式が安全。
- **Implications**:
  - `AtomicPublicDataWriter` を設計し、`staging -> validate -> swap -> cleanup` の順序を採用する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. Node専用で新規CSVパーサー実装 | CLI向けに別実装を追加 | Browserと独立して最適化しやすい | ロジック二重化、仕様差異の温床 | 不採用 |
| B. 既存変換ロジック共有 + ランタイムアダプタ | `CsvTransformer`/`IndexMerger` を共有しCLIを追加 | 一貫した変換結果、既存テスト資産を活用 | 入力抽象化の追加設計が必要 | **採用** |
| C. Browser UI自動操作のみで変換 | AdminPanel経由でローカル運用 | 実運用導線に近い | 手動/自動化負荷が高く再現性が低い | 補助的検証手段 |

## Design Decisions

### Decision: 共有ドメイン契約を中心にCLIを拡張する
- **Context**: ローカル変換でもブラウザ変換と同一結果を保証したい。
- **Alternatives Considered**:
  1. CLI専用変換実装を新設
  2. `CsvTransformer`/`IndexMerger` を共有してCLIはオーケストレーションのみ担当
- **Selected Approach**: Option 2
- **Rationale**: 変換仕様の単一化、既存テストの再利用、保守コスト最小化。
- **Trade-offs**: 入力境界の抽象化（`CsvSource`）を追加設計する必要がある。
- **Follow-up**: Browser・Node双方の入力契約テストを追加する。

### Decision: `public/data` の反映は staging 経由のアトミック置換を採用する
- **Context**: 出力JSON更新失敗時に不完全状態を残せない。
- **Alternatives Considered**:
  1. ファイル単位で直接上書き
  2. staging生成後に一括切替（swap）
- **Selected Approach**: Option 2
- **Rationale**: 検証成功前に公開領域を変更しないため、失敗時にロールバック不要で安全。
- **Trade-offs**: 一時領域のディスク使用量が増える。
- **Follow-up**: staging掃除失敗時の運用手順を明記する。

### Decision: ローカル検証を「契約検証 + UIスモーク」に分離する
- **Context**: 要件3（データ品質）と要件4（画面確認）を独立して担保したい。
- **Alternatives Considered**:
  1. UI確認のみ
  2. データ検証のみ
  3. 契約検証とUIスモークを段階化
- **Selected Approach**: Option 3
- **Rationale**: 失敗箇所の切り分けが容易で再実行性を高められる。
- **Trade-offs**: 実行ステップは増える。
- **Follow-up**: 変換コマンドに `--skip-ui-check` 等の実行モードを設けるか検討する。

## Risks & Mitigations
- `data/sample` 内CSV欠落・命名揺れで入力が不足するリスク — ファイル列挙時に必須条件を検証し、不足一覧を即時出力して処理中断。
- 生成JSONは正しいが参照不整合（`sessionIds` と `sessions/*.json` 不一致）が起きるリスク — 置換前に整合性検証を実施し、失敗時はswapしない。
- `.kiro/steering` 不在で標準方針との差異が発生するリスク — 本設計に前提制約として明記し、後続レビューで補完する。

## References
- [Node.js API: Globals (`crypto`, `TextDecoder`)](https://nodejs.org/api/globals.html) — Node標準APIの利用可否確認
- [Node.js API: Web Crypto](https://nodejs.org/api/webcrypto.html) — `crypto.subtle.digest` の仕様確認
- [Node.js API: util.TextDecoder](https://nodejs.org/api/util.html) — `utf-16le` デコード対応確認
- [Node.js API: File system (`fsPromises.rename`)](https://nodejs.org/api/fs.html) — 反映時のファイル切替方針確認
- [PapaParse Documentation](https://www.papaparse.com/docs) — TSVパース設定の確認
