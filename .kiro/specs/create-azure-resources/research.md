# Research & Design Decisions — create-azure-resources

## Summary
- **Feature**: `create-azure-resources`
- **Discovery Scope**: Extension（既存blob-static-dashboardプロジェクトへのインフラ自動化追加）
- **Key Findings**:
  - Azure PowerShell Azモジュールで全要件を実現可能（Bicep不要）
  - `$web`コンテナ名はPowerShellの変数展開問題があり、シングルクォート必須
  - Stored Access Policyの権限文字列は`racwdxltmeop`順序に従う必要がある（`rcwl`が正しい）

## Research Log

### Azure PowerShell Azモジュール コマンドレット調査
- **Context**: 要件でPowerShell（Azモジュール）によるリソースプロビジョニングが指定されている
- **Sources Consulted**: Microsoft Learn公式ドキュメント（Az.Storage モジュール）
- **Findings**:
  - `New-AzStorageAccount` / `Set-AzStorageAccount`: StorageV2/Standard_LRS/Hot/TLS1_2/HTTPS-onlyをすべてパラメータで指定可能
  - `Enable-AzStorageStaticWebsite`: 静的サイト有効化の専用コマンドレットが存在する。有効化すると`$web`コンテナが自動作成される
  - `Set-AzStorageCORSRule`: 既存ルールをすべて上書きする動作（追加ではない）。今回は完全上書きが要件に合致
  - `New-AzStorageContainerStoredAccessPolicy`: ポリシー作成。`Set-AzStorageContainerStoredAccessPolicy`で更新
  - `New-AzStorageContainerSASToken`: Policyベースの場合は`-Permission`を指定しない（ポリシーから継承）
  - `Set-AzStorageBlobContent`: ファイル単位のアップロード。Content-Type自動検出なし（明示指定必要）
- **Implications**: 全操作がPowerShellコマンドレットで完結。外部ツール（AzCopy等）不要

### `$web`コンテナのPowerShell変数展開問題
- **Context**: PowerShellが`$web`を変数として解釈する既知の問題
- **Sources Consulted**: Azure/azure-powershell Issue #10884
- **Findings**: ダブルクォート内で`$web`と記述するとPowerShell変数として展開される。シングルクォート`'$web'`を使用するか、バッククォート`` `$web ``でエスケープが必要
- **Implications**: 全スクリプトでコンテナ名参照時にシングルクォートを使用する設計ルールを適用

### Stored Access Policy権限文字列の順序
- **Context**: 要件5でRead, Write, Create, List権限を指定
- **Sources Consulted**: Azure Storage REST API仕様（Create Service SAS）
- **Findings**: 権限文字列は`racwdxltmeop`の固定順序に従う必要がある。Read(r), Create(c), Write(w), List(l) → `"rcwl"`が正しい順序。`"rwcl"`は不正
- **Implications**: スクリプト内のポリシー権限は`"rcwl"`と指定

### Content-Type自動検出の非対応
- **Context**: 要件7で静的ファイルアップロード時に適切なContent-Typeを設定
- **Sources Consulted**: Azure/azure-powershell Issue #12989
- **Findings**: `Set-AzStorageBlobContent`はデフォルトで`application/octet-stream`を設定する。拡張子からの自動検出は行われない
- **Implications**: MIME型マッピングテーブルをスクリプト内に定義し、`-Properties @{ ContentType = "..." }`で明示指定する

### リソース存在確認パターン
- **Context**: 要件1で冪等性を担保するために存在確認が必要
- **Sources Consulted**: Azure/azure-powershell Issue #12644
- **Findings**: `Get-AzResourceGroup`および`Get-AzStorageAccount`は、リソースが存在しない場合に例外をスローする（`$null`を返すのではない）。`-ErrorAction SilentlyContinue`が必須
- **Implications**: 全存在確認パターンで`-ErrorAction SilentlyContinue`を使用

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| PowerShellスクリプト直接実行 | Azモジュールで直接リソースを操作 | シンプル、冪等性を細かく制御可能、学習コスト低 | IaCとしてのバージョン管理はスクリプト自体で行う | 採用 |
| Bicep/ARMテンプレート | 宣言的IaC | 自動的な冪等性、差分検出 | 静的サイトホスティング有効化やStored Access PolicyがBicep非対応 | 却下：追加スクリプトが必要で複雑化 |
| Terraform | HashiCorp製IaC | クロスクラウド対応、成熟したエコシステム | 追加ツールの導入が必要、状態ファイル管理 | 却下：過剰な複雑性 |

## Design Decisions

### Decision: PowerShellスクリプトによる命令的プロビジョニング
- **Context**: Azureリソースの作成と設定を自動化する方法の選択
- **Alternatives Considered**:
  1. Bicep/ARMテンプレート — 宣言的だが静的サイトホスティング有効化がネイティブ非対応
  2. Terraform — クロスクラウド対応だが追加ツール導入が必要
  3. PowerShellスクリプト — 命令的だが全操作をカバー可能
- **Selected Approach**: PowerShellスクリプト（Azモジュール）による命令的プロビジョニング
- **Rationale**: 全要件（Storage作成、静的サイト有効化、CORS設定、Stored Access Policy、SAS生成、ファイルアップロード）をPowerShell単体で完結可能。冪等性は存在確認＋条件分岐で実現
- **Trade-offs**: 宣言的IaCの差分検出は得られないが、設定の強制上書きが要件であるため問題なし
- **Follow-up**: スクリプトの動作テストは実Azure環境で実施

### Decision: 3スクリプト分離構成
- **Context**: 全操作を1スクリプトにまとめるか、役割ごとに分離するか
- **Alternatives Considered**:
  1. 単一スクリプト — すべての操作を1ファイルに集約
  2. 3スクリプト分離 — プロビジョニング / SAS生成 / ファイルデプロイを分離
- **Selected Approach**: 3スクリプト分離（`Deploy-Infrastructure.ps1`, `New-SasToken.ps1`, `Deploy-StaticFiles.ps1`）
- **Rationale**: プロビジョニングは初回/設定変更時のみ、SAS生成は期限切れ時のみ、ファイルデプロイはアプリ更新時のみ実行するため、ライフサイクルが異なる
- **Trade-offs**: スクリプト間でパラメータの重複があるが、共通デフォルト値で一貫性を維持
- **Follow-up**: 全スクリプトで共通のパラメータブロックを使用

### Decision: Content-Type MIMEマッピングの内蔵
- **Context**: `Set-AzStorageBlobContent`がContent-Type自動検出に非対応
- **Selected Approach**: スクリプト内にMIME型マッピングハッシュテーブルを定義
- **Rationale**: 外部設定ファイルを不要にし、スクリプト単体で動作可能にする。対象ファイル種別は限定的（HTML/CSS/JS/JSON/PNG/SVG/ICO程度）
- **Trade-offs**: 新規ファイル種別追加時にスクリプト修正が必要だが、静的サイトの構成は安定しているため許容範囲

## Risks & Mitigations
- **Azモジュール未インストール**: スクリプト冒頭で`Az`モジュールの存在を確認し、未インストール時はエラーメッセージで案内
- **認証切れ**: `Connect-AzAccount`が必要。スクリプトは認証済みを前提とし、未認証時のエラーはAzモジュールのデフォルトメッセージに委ねる
- **リージョン指定漏れ**: リソースグループ新規作成時にリージョン指定が必要。パラメータにデフォルト値（`japaneast`）を設定

## References
- [New-AzStorageAccount | Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/az.storage/new-azstorageaccount)
- [Enable-AzStorageStaticWebsite | Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/az.storage/enable-azstoragestaticwebsite)
- [Set-AzStorageCORSRule | Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/az.storage/set-azstoragecorsrule)
- [New-AzStorageContainerStoredAccessPolicy | Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/az.storage/new-azstoragecontainerstoredaccesspolicy)
- [New-AzStorageContainerSASToken | Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/az.storage/new-azstoragecontainersastoken)
- [Host a static website in Azure Storage | Microsoft Learn](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to)
- [Create a service SAS - Azure Storage REST API](https://learn.microsoft.com/en-us/rest/api/storageservices/create-service-sas)
- [Azure/azure-powershell Issue #10884 — $web container name](https://github.com/Azure/azure-powershell/issues/10884)
- [Azure/azure-powershell Issue #12989 — Content-Type auto-detect](https://github.com/Azure/azure-powershell/issues/12989)
