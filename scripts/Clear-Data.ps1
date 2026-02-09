<#
.SYNOPSIS
    Azure Blob Storage ($web コンテナ) のセッションデータをクリアするスクリプト

.DESCRIPTION
    $web コンテナの data/ 配下にアップロードされたセッションデータを削除し、
    data/index.json を空の初期状態にリセットする。
    ローカルファイルには一切変更を加えない。

    対象:
      - data/sessions/*.json  → 全削除
      - data/index.json       → 空の初期状態で上書き

.PARAMETER EnvFile
    .env ファイルのパス（デフォルト: プロジェクトルートの .env）
#>
param(
    [string]$EnvFile = ""
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
Import-EnvParams -EnvPath $EnvFile

# ============================================================
# Step 1: Azure接続
# ============================================================
Write-Step "Step 1: Azure接続"
$accountKey = Connect-AzureStorage -SubscriptionId $AZURE_SUBSCRIPTION_ID -ResourceGroupName $AZURE_RESOURCE_GROUP_NAME -StorageAccountName $AZURE_STORAGE_ACCOUNT_NAME

# ============================================================
# Step 2: data/ 配下のBlob削除
# ============================================================
Write-Step "Step 2: data/ 配下のBlob削除"

# data/ 配下のBlob一覧を取得
$blobsJson = az storage blob list `
    --container-name '$web' `
    --prefix 'data/' `
    --account-name $AZURE_STORAGE_ACCOUNT_NAME `
    --account-key $accountKey `
    --output json
$blobs = $blobsJson | ConvertFrom-Json

if ($null -eq $blobs -or @($blobs).Count -eq 0) {
    Write-Warn "data/ 配下にBlobが存在しません。スキップします。"
    $deleteCount = 0
} else {
    Write-Info "data/ 配下のBlob数: $(@($blobs).Count)"

    # data/index.json 以外のBlobを削除
    $deleteCount = 0
    foreach ($blob in $blobs) {
        if ($blob.name -eq "data/index.json") {
            Write-Info "  [スキップ] $($blob.name) (Step 3で上書き)"
            continue
        }
        az storage blob delete `
            --container-name '$web' `
            --name $blob.name `
            --account-name $AZURE_STORAGE_ACCOUNT_NAME `
            --account-key $accountKey | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Blobの削除に失敗しました: $($blob.name)" }
        $deleteCount++
        Write-Info "  [削除] $($blob.name)"
    }
    Write-Success "削除完了: $deleteCount 件のBlobを削除しました"
}

# ============================================================
# Step 3: 空の index.json で上書き
# ============================================================
Write-Step "Step 3: index.json の初期化"

# シードファイルを使用して Azure 上の data/index.json を上書き
$seedFile = Join-Path $PSScriptRoot "seed" "index.json"
if (-not (Test-Path $seedFile)) { throw "シードファイルが見つかりません: $seedFile" }

az storage blob upload `
    --file $seedFile `
    --container-name '$web' `
    --name 'data/index.json' `
    --content-type 'application/json; charset=utf-8' `
    --account-name $AZURE_STORAGE_ACCOUNT_NAME `
    --account-key $accountKey `
    --overwrite | Out-Null
if ($LASTEXITCODE -ne 0) { throw "data/index.json のアップロードに失敗しました" }
Write-Success "data/index.json を初期状態で上書きしました"

# ============================================================
# Step 4: 結果サマリー
# ============================================================
$webEndpoint = (az storage account show --resource-group $AZURE_RESOURCE_GROUP_NAME --name $AZURE_STORAGE_ACCOUNT_NAME --query "primaryEndpoints.web" --output tsv)

Write-Step "データクリア完了"
Write-Detail "Storageアカウント" $AZURE_STORAGE_ACCOUNT_NAME
Write-Detail "削除したBlob数" "$deleteCount"
Write-Detail "index.json" "初期化済み (シードファイルで上書き)"
Write-Detail "静的サイトURL" $webEndpoint
Write-Info ""
Write-Success "全ステップが正常に完了しました"
