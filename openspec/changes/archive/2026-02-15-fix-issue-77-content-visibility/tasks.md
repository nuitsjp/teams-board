## 1. スタイル定義の追加

- [x] 1.1 `src/index.css` に `content-visibility: auto` を含む Tailwind カスタムユーティリティを追加する
- [x] 1.2 同ユーティリティに `contain-intrinsic-size` を設定し、既存行高に整合する値を定義する

## 2. MemberList への適用

- [x] 2.1 `src/components/MemberList.jsx` の各行要素にカスタムユーティリティクラスを適用する
- [x] 2.2 既存レイアウトや可読性を維持しつつクラス適用による副作用がないことを確認する

## 3. 検証

- [x] 3.1 `pnpm test` を実行し、既存テストが全件通過することを確認する
- [x] 3.2 `pnpm run lint` と `pnpm run build` を実行し、静的検査とビルドが成功することを確認する
