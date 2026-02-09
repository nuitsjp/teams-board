<#
.SYNOPSIS
    利用者用URLおよび管理者用URL（SASトークン付き）を表示する

.DESCRIPTION
    静的サイトの利用者用エンドポイントURLと、
    Stored Access Policyに基づくSASトークン付きの管理者用URLを表示する。

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）

.PARAMETER PolicyName
    Stored Access Policyの名前（デフォルト: dashboard-admin）
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$PolicyName = "dashboard-admin"
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
$envSettings = Load-EnvSettings
$applied = Apply-EnvSettings -Settings $envSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "AZURE_SUBSCRIPTION_ID"
    "ResourceGroupName"  = "AZURE_RESOURCE_GROUP_NAME"
    "StorageAccountName" = "AZURE_STORAGE_ACCOUNT_NAME"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# Azure接続・アカウントキー取得
$accountKey = Connect-AzureStorage -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -StorageAccountName $StorageAccountName

# SASトークン生成（Policyから権限を継承）
$sasToken = (az storage container generate-sas `
    --name '$web' `
    --policy-name $PolicyName `
    --https-only `
    --account-name $StorageAccountName `
    --account-key $accountKey `
    --output tsv)
if ($LASTEXITCODE -ne 0) { throw "SASトークンの生成に失敗しました" }

# 静的サイトエンドポイントURLの取得
$webEndpoint = (az storage account show --resource-group $ResourceGroupName --name $StorageAccountName --query "primaryEndpoints.web" --output tsv)
$webEndpoint = $webEndpoint.TrimEnd('/')

# URL組み立て（SASトークンをURLエンコードして token= に格納）
$userUrl = "${webEndpoint}/index.html"
$encodedSas = [System.Uri]::EscapeDataString($sasToken)
$adminUrl = "${webEndpoint}/index.html?token=${encodedSas}"

# 結果出力
Write-Step "ダッシュボードURL"
Write-Info ""
Write-Success "--- 利用者用URL ---"
Write-Info $userUrl
Write-Info ""
Write-Success "--- 管理者用URL ---"
Write-Info $adminUrl
Write-Info ""
