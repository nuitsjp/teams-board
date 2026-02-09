<#
.SYNOPSIS
    利用者用URLおよび管理者用URL（SASトークン付き）を表示する

.DESCRIPTION
    静的サイトの利用者用エンドポイントURLと、
    Stored Access Policyに基づくSASトークン付きの管理者用URLを表示する。

.PARAMETER EnvFile
    .env ファイルのパス（デフォルト: プロジェクトルートの .env）

.PARAMETER PolicyName
    Stored Access Policyの名前（デフォルト: dashboard-admin）
#>
param(
    [string]$EnvFile = "",
    [string]$PolicyName = "dashboard-admin"
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
Import-EnvParams -EnvPath $EnvFile

# Azure接続・アカウントキー取得
$accountKey = Connect-AzureStorage -SubscriptionId $AZURE_SUBSCRIPTION_ID -ResourceGroupName $AZURE_RESOURCE_GROUP_NAME -StorageAccountName $AZURE_STORAGE_ACCOUNT_NAME

# SASトークン生成（Policyから権限を継承）
$sasToken = (az storage container generate-sas `
    --name '$web' `
    --policy-name $PolicyName `
    --https-only `
    --account-name $AZURE_STORAGE_ACCOUNT_NAME `
    --account-key $accountKey `
    --output tsv)
if ($LASTEXITCODE -ne 0) { throw "SASトークンの生成に失敗しました" }

# 静的サイトエンドポイントURLの取得
$webEndpoint = (az storage account show --resource-group $AZURE_RESOURCE_GROUP_NAME --name $AZURE_STORAGE_ACCOUNT_NAME --query "primaryEndpoints.web" --output tsv)
$webEndpoint = $webEndpoint.TrimEnd('/')

# URL組み立て（SASトークンをURLエンコードして token= に格納）
$userUrl = "${webEndpoint}/index.html"
$encodedSas = [System.Uri]::EscapeDataString($sasToken)
$adminUrl = "${webEndpoint}/index.html?token=${encodedSas}"

# 結果出力
Write-Step "ダッシュボードURL"
Write-Success "利用者用URL: $userUrl"
Write-Success "管理者用URL: $adminUrl"
