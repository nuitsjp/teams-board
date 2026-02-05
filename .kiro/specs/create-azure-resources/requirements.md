# Requirements Document

## Introduction

blob-static-dashboardの稼働基盤として必要なAzureリソースを、冪等なPowerShellスクリプトでプロビジョニングする。対象はAzure Storage Account（静的サイトホスティング有効化、CORS設定、`$web`コンテナ、Stored Access Policy）を中心とし、閉域ネットワーク＋SASトークンによるアクセス制御を前提とする。スクリプトは実行前にリソースの存在を確認し、既存リソースを活用しつつ、Storageアカウントの設定は常に正しい状態に強制上書きする。

### デフォルトパラメータ

| パラメータ | デフォルト値 |
|-----------|------------|
| サブスクリプションID | `9f8bb535-5bea-4687-819e-7605b47941b5` |
| リソースグループ名 | `z2-rg-usr-z23004-dev-002` |
| Storageアカウント名 | `ststudylogprod` |

### コスト最適化方針

- アクセス層: **Hot**（必須）
- パフォーマンス: **Standard**（Premium不要）
- 冗長性: **LRS**（ローカル冗長、最小コスト）
- 種類: **StorageV2**（静的サイトホスティングに必要な最小構成）

## Requirements

### Requirement 1: 冪等なリソースプロビジョニングスクリプト
**Objective:** インフラ管理者として、PowerShellスクリプトでAzureリソースを冪等にプロビジョニングしたい。何度実行しても同じ結果が得られ、既存リソースを破壊しない。

#### Acceptance Criteria
1. The プロビジョニングスクリプト shall PowerShell（`Az`モジュール）で記述する
2. When サブスクリプションが指定された時, the プロビジョニングスクリプト shall 対象サブスクリプションに切り替えてから処理を実行する
3. When リソースグループが既に存在する場合, the プロビジョニングスクリプト shall 既存のリソースグループをそのまま利用する
4. When リソースグループが存在しない場合, the プロビジョニングスクリプト shall リソースグループを新規作成する
5. When Storageアカウントが既に存在する場合, the プロビジョニングスクリプト shall 設定を正しい値に強制上書きする
6. When Storageアカウントが存在しない場合, the プロビジョニングスクリプト shall 新規作成する
7. The プロビジョニングスクリプト shall 各ステップの実行状況（存在確認結果、作成/更新の区別）をコンソールに出力する
8. If いずれかのステップでエラーが発生した場合, the プロビジョニングスクリプト shall エラー内容を表示して非ゼロの終了コードで終了する

### Requirement 2: Storageアカウント設定
**Objective:** インフラ管理者として、Storageアカウントをblob-static-dashboardに必要な設定で構成したい。コストを最小限に抑えつつ、静的サイトホスティングに必要な機能を確保する。

#### Acceptance Criteria
1. The プロビジョニングスクリプト shall Storageアカウントを`StorageV2`種類・`Standard_LRS`冗長性・`Hot`アクセス層で構成する
2. The プロビジョニングスクリプト shall Storageアカウントの最小TLSバージョンを`TLS1_2`に設定する
3. The プロビジョニングスクリプト shall HTTPSトラフィックのみを許可する設定を適用する
4. The プロビジョニングスクリプト shall Storageアカウントが既に存在する場合でも、上記設定を強制的に上書きする

### Requirement 3: 静的サイトホスティングの有効化
**Objective:** インフラ管理者として、Storageアカウント上で静的サイトホスティングを有効にし、`$web`コンテナをダッシュボードの配信基盤として利用したい。

#### Acceptance Criteria
1. The プロビジョニングスクリプト shall 静的サイトホスティングを有効化し、インデックスドキュメントを`index.html`に設定する
2. The プロビジョニングスクリプト shall エラードキュメントを`index.html`に設定する（SPAフォールバック対応）
3. When プロビジョニングが完了した時, the プロビジョニングスクリプト shall 静的サイトエンドポイントURL（`*.web.core.windows.net`）を出力する
4. When プロビジョニングが完了した時, the プロビジョニングスクリプト shall BlobサービスエンドポイントURL（`*.blob.core.windows.net`）を出力する

### Requirement 4: CORS設定
**Objective:** インフラ管理者として、ブラウザからBlobサービスエンドポイントへのクロスオリジンリクエスト（PUT/GET）を許可するCORS設定を構成したい。管理者のCSV→JSON書き込みフローが正しく動作する。

#### Acceptance Criteria
1. The プロビジョニングスクリプト shall BlobサービスのCORS設定で、静的サイトエンドポイントのオリジンを許可する
2. The プロビジョニングスクリプト shall CORS許可メソッドに`GET`, `PUT`, `HEAD`を含める
3. The プロビジョニングスクリプト shall CORS許可ヘッダーに`x-ms-blob-type`, `x-ms-blob-content-type`, `content-type`, `x-ms-version`を含める
4. The プロビジョニングスクリプト shall CORS公開ヘッダーに`x-ms-meta-*`を含める
5. The プロビジョニングスクリプト shall CORS設定を常に上書き適用する（既存設定があっても正しい値に強制する）

### Requirement 5: Stored Access Policyの定義
**Objective:** インフラ管理者として、`$web`コンテナにStored Access Policyを定義し、SASトークンの一括失効を可能にしたい。セキュリティインシデント発生時にSASを即座に無効化できる。

#### Acceptance Criteria
1. The プロビジョニングスクリプト shall `$web`コンテナにStored Access Policyを作成する
2. The プロビジョニングスクリプト shall ポリシーの権限を`Read`, `Write`, `Create`, `List`に限定する
3. The プロビジョニングスクリプト shall ポリシーの有効期限をパラメータとして外部から設定可能にする（デフォルト: 30日後）
4. When 同名のポリシーが既に存在する場合, the プロビジョニングスクリプト shall 既存ポリシーを最新の設定で上書きする

### Requirement 6: SASトークン生成スクリプト
**Objective:** インフラ管理者として、Stored Access Policyに紐づくContainer SASトークンを生成するスクリプトを利用したい。管理者URL（`index.html?token=<SAS>`）の配布を省力化できる。

#### Acceptance Criteria
1. The SAS生成スクリプト shall PowerShell（`Az`モジュール）で記述する
2. The SAS生成スクリプト shall Stored Access Policyに紐づくContainer SASトークンを生成する
3. The SAS生成スクリプト shall 生成したSASトークンを含む管理者用完全URL（`https://<static-site-endpoint>/index.html?token=<SAS>`）を出力する
4. The SAS生成スクリプト shall Storageアカウント名をパラメータとして受け取る（デフォルト: `ststudylogprod`）

### Requirement 7: 静的ファイルのデプロイスクリプト
**Objective:** インフラ管理者として、`frontend/dashboard/public/`配下の静的ファイルを`$web`コンテナにアップロードするスクリプトを利用したい。アプリケーションの初期配置と更新を自動化できる。

#### Acceptance Criteria
1. The アップロードスクリプト shall PowerShell（`Az`モジュール）で記述する
2. The アップロードスクリプト shall `frontend/dashboard/public/`配下のファイルを`$web`コンテナにアップロードする
3. The アップロードスクリプト shall HTML/CSS/JS/JSONファイルに適切なContent-Typeを設定する
4. The アップロードスクリプト shall Storageアカウント名をパラメータとして受け取る（デフォルト: `ststudylogprod`）
5. When アップロードが完了した時, the アップロードスクリプト shall アップロードされたファイル数と静的サイトURLを表示する

### Requirement 8: スクリプトのパラメータ設計
**Objective:** インフラ管理者として、全スクリプトで一貫したパラメータ設計を利用したい。デフォルト値を提供しつつ、必要に応じて環境固有の値に変更可能にする。

#### Acceptance Criteria
1. The 全スクリプト shall PowerShellの`param()`ブロックでパラメータを定義する
2. The 全スクリプト shall サブスクリプションID・リソースグループ名・Storageアカウント名にデフォルト値を設定する
3. The 全スクリプト shall パラメータをコマンドライン引数で上書き可能にする
4. The 全スクリプト shall スクリプト先頭にパラメータの説明をコメントで記載する

## Project Description (Input)
create-azure-resources
