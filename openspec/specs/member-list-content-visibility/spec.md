## Purpose

長い MemberList の描画コストを抑えるため、行単位で `content-visibility` を適用する要件を定義する。

## ADDED Requirements

### Requirement: MemberList 行要素の content-visibility 適用

システムは、`MemberList` の各行要素に `content-visibility: auto` を適用しなければならない（MUST）。これにより、画面外の行要素は必要になるまで描画を遅延できること。

#### Scenario: 画面外行の描画遅延
- **WHEN** メンバー数が多い状態で MemberList が表示される
- **THEN** システムは各行に `content-visibility: auto` を適用し、画面外行のレンダリングコストを抑える

### Requirement: MemberList 行要素の推定サイズ定義

システムは、`MemberList` の各行要素に `contain-intrinsic-size` を適用しなければならない（MUST）。適用値は既存レイアウトに整合し、スクロール中のレイアウト崩れを防止できる値であること。

#### Scenario: 推定サイズによるレイアウト安定化
- **WHEN** 画面外行が表示領域に入って初回描画される
- **THEN** システムは `contain-intrinsic-size` に基づいて安定したレイアウトを維持し、顕著なレイアウトジャンプを発生させない

### Requirement: Tailwind カスタムユーティリティでの提供

システムは、`content-visibility` と `contain-intrinsic-size` のスタイルを `src/index.css` の Tailwind 4 カスタムユーティリティとして定義しなければならない（MUST）。`MemberList` ではそのユーティリティクラスを利用して適用すること。

#### Scenario: ユーティリティクラス経由の適用
- **WHEN** MemberList の行コンポーネントがレンダリングされる
- **THEN** システムはインライン style ではなくカスタムユーティリティクラスを通じて最適化スタイルを適用する
