<#
.SYNOPSIS
    Stored Access Policyに紐づくContainer SASトークンを生成し、管理者用URLを出力する

.DESCRIPTION
    blob-static-dashboardの管理者向けSASトークンを生成し、
    静的サイトエンドポイントを含む完全なアクセスURLを出力する。
    SASトークンはStored Access Policyから権限を継承する。

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
Write-Action "SASトークンを生成しています (Policy: $PolicyName)..."
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

# SASトークンをURLエンコードして token= パラメータに格納
# （エンコードしないと & がURLパラメータ区切りと誤解される）
$encodedSas = [System.Uri]::EscapeDataString($sasToken)
$adminUrl = "${webEndpoint}/index.html?token=${encodedSas}"

# 結果出力
Write-Step "SASトークン生成完了"
Write-Detail "Storageアカウント" $StorageAccountName
Write-Detail "Policy" $PolicyName
Write-Info ""
Write-Info "--- SASトークン ---"
Write-Info $sasToken
Write-Info ""
Write-Info "--- 管理者用URL ---"
Write-Info $adminUrl
Write-Info ""

# パイプライン出力用にURLを返す
Write-Output $adminUrl
