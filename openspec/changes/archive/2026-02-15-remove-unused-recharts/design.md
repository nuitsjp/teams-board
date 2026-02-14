## Context

`recharts` (v3.7.0) は `package.json` の `dependencies` に登録されているが、ソースコード内で一切使用されていない。CLAUDE.md の Tech Stack には「recharts — データ可視化（グラフ・チャート）」と記載されているが、実際にはまだ実装に使用されていない状態である。

現在 recharts を参照しているファイルは以下の3つのみ：
- `package.json` — 依存定義
- `pnpm-lock.yaml` — ロックファイル（自動管理）
- `.vscode/settings.json` — スペルチェック辞書

## Goals / Non-Goals

**Goals:**
- `recharts` パッケージとその推移的依存を完全に削除する
- ビルド・テスト・lint がすべて正常に通ることを確認する
- バンドルサイズの削減を検証する

**Non-Goals:**
- 代替のチャートライブラリの導入（将来必要になった時点で検討する）
- CLAUDE.md の Tech Stack セクションの更新（別途対応）

## Decisions

### 1. `pnpm remove recharts` で削除する

**選択**: pnpm の remove コマンドを使用して依存を削除する。

**理由**: `package.json` の手動編集ではなく、パッケージマネージャーのコマンドを使用することで `pnpm-lock.yaml` の整合性が自動的に保たれる。

**代替案**: `package.json` を手動編集して `pnpm install` を実行する方法もあるが、`pnpm remove` の方が1ステップで完結し安全。

### 2. `.vscode/settings.json` のスペルチェック辞書も更新する

**選択**: `recharts` をスペルチェック辞書から削除する。

**理由**: パッケージ削除後は辞書に残す意味がなく、不要なエントリを整理する。

## Risks / Trade-offs

- **将来 recharts が必要になった場合** → `pnpm add recharts` で再度追加すればよい。削除は完全に可逆的。
- **推移的依存の削除による影響** → recharts の推移的依存（`react-is`、`redux` 等）が他のパッケージで使用されていない場合のみ削除される。pnpm が自動的に判断するためリスクは低い。
