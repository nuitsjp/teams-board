## REMOVED Requirements

### Requirement: recharts 依存の削除
プロジェクトの `dependencies` から未使用の `recharts` パッケージを削除しなければならない（SHALL）。ソースコード内に `recharts` の import が存在しないことが前提条件である。

**Reason**: `recharts` (v3.7.0, 約300KB+) はコード中で一切使用されておらず、バンドルサイズと `pnpm install` 時間を不必要に増加させている。
**Migration**: 将来チャート機能が必要になった場合は `pnpm add recharts` で再追加する。

#### Scenario: recharts パッケージの削除
- **WHEN** `pnpm remove recharts` を実行した場合
- **THEN** `package.json` の `dependencies` から `recharts` エントリが削除される
- **THEN** `pnpm-lock.yaml` から `recharts` 関連エントリが削除される

#### Scenario: 削除後のビルド成功
- **WHEN** `recharts` 削除後に `pnpm run build` を実行した場合
- **THEN** ビルドがエラーなく成功する

#### Scenario: 削除後のテスト成功
- **WHEN** `recharts` 削除後に `pnpm test` を実行した場合
- **THEN** すべてのユニットテストがパスする

#### Scenario: 削除後の lint 成功
- **WHEN** `recharts` 削除後に `pnpm run lint` を実行した場合
- **THEN** ESLint エラーが発生しない
