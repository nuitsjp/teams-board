## Why

開発環境（`pnpm run dev`）では、利用者モードはテストできるが、管理者モードをテストできない。現在、管理者モードは有効なAzure Blob Storage SASトークンを必要とするため、AdminPageの一括保存やグループ名編集機能の開発・テストが困難になっている。開発環境で管理者機能を完全にテストできるようにすることで、開発効率を向上させ、E2Eテストでも管理者モードのシナリオをカバーできるようにする。

## What Changes

- 開発用ダミートークン（`?token=dev`）で管理者モードへ入れるようにする
- 開発環境でBlobWriterをモック化し、実際のAzure Blob Storageへのリクエストをスキップ、またはローカルファイルシステムへ書き込む
- E2Eテスト（Playwright）で管理者モードのシナリオをテストできるようにする

## Capabilities

### New Capabilities

- `dev-auth-token`: 開発環境で使用できるダミー認証トークンのサポート。`?token=dev`で管理者モードへ入れるようにする
- `blob-writer-mock`: 開発環境でのBlobWriter動作のモック化。実際のAzure Blob Storageへのアクセスをスキップし、ローカルの`dev-fixtures/data/`へ書き込むか、成功レスポンスを返す

### Modified Capabilities

なし

## Impact

- **影響を受けるコード**:
  - `src/hooks/useAuth.jsx`: ダミートークンの認識を追加
  - `src/services/BlobWriter.js`: 開発環境でのモック動作を追加
  - E2Eテスト： 管理者モードのテストシナリオを追加可能に

- **システム影響**:
  - 開発環境のみに影響、本番環境の動作は変更なし
  - Vite開発サーバーでの動作が拡張される

- **依存関係**:
  - 既存の依存関係に変更なし
  - `import.meta.env.DEV`を使用して開発環境を検出
