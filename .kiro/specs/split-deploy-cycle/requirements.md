# Requirements Document

## Introduction

現在の `Deploy-StaticFiles.ps1` は `frontend/dashboard/public/` 配下の全ファイルを再帰的にBlobへアップロードしている。この中には `data/` ディレクトリ（ダミーデータ / 業務データ）が含まれており、アプリケーションコードの更新時にデータも同時に上書きデプロイされてしまう。

アプリケーションコード（HTML/CSS/JS/ライブラリ）とデータ（JSON）はライフサイクルが異なるため、デプロイスクリプトから `data/` を除外し、デプロイサイクルを分離する。

## Requirements

### Requirement 1: data/ディレクトリのデプロイ除外

**Objective:** 運用者として、静的ファイルのデプロイ時にdata/ディレクトリが除外されるようにしたい。これにより、アプリコード更新時に既存のデータが意図せず上書きされることを防ぐ。

#### Acceptance Criteria

1.1. When `Deploy-StaticFiles.ps1` をデフォルト設定で実行した場合、the Deploy-StaticFiles スクリプト shall `public/data/` 配下のファイルをアップロード対象から除外する

1.2. When `Deploy-StaticFiles.ps1` をデフォルト設定で実行した場合、the Deploy-StaticFiles スクリプト shall `public/` 配下の `data/` 以外のファイル（HTML、CSS、JS、ライブラリ）を従来通りアップロードする

1.3. When `Deploy-StaticFiles.ps1` を `src/` ソースパスで実行した場合、the Deploy-StaticFiles スクリプト shall `src/` 配下のファイルを影響なく従来通りアップロードする（`src/` には `data/` が存在しないため）

1.4. The Deploy-StaticFiles スクリプト shall 除外理由をスクリプトの説明コメント（`.DESCRIPTION`）に記載する
