## 1. IndexMerger の Map ベース最適化

- [x] 1.1 `merge()` 内のグループ配列コピー（`map()`）を、配列と `groupMap`（`id → グループ参照`）を同時に構築するコードに置換する
- [x] 1.2 `groups.find((g) => g.id === newSession.groupId)` を `groupMap.get(newSession.groupId)` に置換する
- [x] 1.3 `merge()` 内のメンバー配列コピー（`map()`）を、配列と `memberMap`（`id → メンバー参照`）を同時に構築するコードに置換する
- [x] 1.4 `members.find((m) => m.id === attendance.memberId)` を `memberMap.get(attendance.memberId)` に置換する

## 2. IndexEditor の Map ベース最適化

- [x] 2.1 `updateGroupName()` 内のグループ配列コピー（`map()`）を、配列と `groupMap`（`id → グループ参照`）を同時に構築するコードに置換する
- [x] 2.2 `groups.find((g) => g.id === groupId)` を `groupMap.get(groupId)` に置換する

## 3. 検証

- [x] 3.1 `pnpm test` で全ユニットテストがパスすることを確認する
- [x] 3.2 `pnpm run lint` で ESLint エラーがないことを確認する
- [x] 3.3 `pnpm run build` でビルドが成功することを確認する
