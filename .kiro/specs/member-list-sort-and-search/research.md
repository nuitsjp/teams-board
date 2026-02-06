# Research & Design Decisions

## Summary
- **Feature**: `member-list-sort-and-search`
- **Discovery Scope**: Extension（既存UIコンポーネントの拡張）
- **Key Findings**:
  - `MemberList.jsx` は単一ファイルで完結しており、変更影響範囲が小さい
  - 現在のソートは `totalDurationSeconds` 降順。`localeCompare` による名称昇順への変更は直接的
  - 新規ライブラリ不要。React の `useState` と標準の `String.prototype` メソッドで実現可能

## Research Log

### 既存コンポーネント構造の調査
- **Context**: 変更対象の `MemberList.jsx` の現状把握
- **Findings**:
  - props: `{ members }` — 配列。各要素は `{ id, name, sessionIds, totalDurationSeconds }`
  - ソート: `[...members].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds)`
  - ヘッダー: 左に「メンバー」見出し（Userアイコン付き）、右にメンバー数バッジ
  - リスト: `sortedMembers.map()` で行を生成。各行クリックで `/members/{id}` へ遷移
  - 外部依存: `lucide-react`（User, Clock, ChevronRight）、`react-router-dom`（useNavigate）、`format-duration` ユーティリティ
- **Implications**: ステートレスコンポーネント → 検索用に `useState` を導入する必要がある

### localeCompare によるソート
- **Context**: 日本語名・英語名混在のソート方式
- **Findings**:
  - `String.prototype.localeCompare('ja')` で自然な日本語ソートが可能
  - ブラウザ組み込みの Intl.Collator を使用するため追加ライブラリ不要
- **Implications**: `a.name.localeCompare(b.name, 'ja')` で要件を満たせる

### lucide-react の Search アイコン
- **Context**: 検索フィールドにアイコンを付与する場合の選択肢
- **Findings**:
  - `lucide-react` は既にプロジェクトで使用中（User, Clock, ChevronRight）
  - `Search` アイコンが利用可能
- **Implications**: 追加インストール不要で検索アイコンを使用可能

## Design Decisions

### Decision: ソートロジックの変更方式
- **Context**: 既存の勉強時間降順ソートを名称昇順に置き換える
- **Alternatives Considered**:
  1. ソート関数を直接書き換え — シンプルに `localeCompare` に変更
  2. ソート切り替えUI追加 — ユーザーがソート基準を選択可能に
- **Selected Approach**: Option 1 — ソート関数の直接書き換え
- **Rationale**: 要件はソートの「変更」であり、切り替え機能は求められていない
- **Trade-offs**: 将来ソート切り替えが必要になった場合は追加実装が必要

### Decision: 検索状態の管理方式
- **Context**: インクリメンタルサーチの状態管理
- **Alternatives Considered**:
  1. `useState` によるローカル状態 — コンポーネント内で完結
  2. URL パラメータ連動 — 検索状態を URL に保持
- **Selected Approach**: Option 1 — `useState` によるローカル状態
- **Rationale**: 検索状態の永続化は不要。コンポーネント内で完結すべき
- **Trade-offs**: ページ遷移で検索状態はリセットされるが、要件上問題なし

## Risks & Mitigations
- **リスク**: 大量メンバー時のフィルタリングパフォーマンス → メンバー数は限定的と想定。問題発生時は `useMemo` で最適化可能
- **リスク**: 日本語ソートの環境差異 → `localeCompare` のロケール指定 `'ja'` で統一
