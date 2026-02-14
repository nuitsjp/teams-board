## Why

`recharts` (v3.7.0, 約300KB+) が `package.json` に依存として登録されているが、ソースコード内で一切 import/使用されていない。未使用の重い依存を削除することで、バンドルサイズを削減し、インストール時間を短縮する。

## What Changes

- `package.json` から `recharts` 依存を削除
- `pnpm-lock.yaml` から `recharts` 関連エントリが自動削除される
- `.vscode/settings.json` のスペルチェック辞書から `recharts` を削除

## Capabilities

### New Capabilities

なし（既存機能の変更・追加はない）

### Modified Capabilities

なし（`recharts` はコード中で未使用のため、動作への影響はない）

## Impact

- **依存関係**: `recharts` とその推移的依存（`react-is`、`redux` 等）が削除される
- **バンドルサイズ**: 本番ビルドのサイズが削減される（recharts は tree-shake されている可能性もあるが、依存ツリー自体の整理になる）
- **開発体験**: `pnpm install` の速度が向上する
- **既存機能への影響**: なし（ソースコードに recharts の import が存在しないため）
