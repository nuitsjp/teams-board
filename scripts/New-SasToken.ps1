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

# サブスクリプション切替
Write-Host "サブスクリプションを切り替えています..." -ForegroundColor Cyan
Set-AzContext -SubscriptionId $SubscriptionId | Out-Null

# Storageアカウントのコンテキスト取得
Write-Host "Storageアカウント '$StorageAccountName' に接続しています..." -ForegroundColor Cyan
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName
$ctx = $sa.Context

# SASトークン生成（Policyから権限を継承）
Write-Host "SASトークンを生成しています (Policy: $PolicyName)..." -ForegroundColor Cyan
$sasToken = New-AzStorageContainerSASToken `
    -Name '$web' `
    -Policy $PolicyName `
    -Protocol HttpsOnly `
    -Context $ctx

# 静的サイトエンドポイントURLの取得
$webEndpoint = $sa.PrimaryEndpoints.Web.TrimEnd('/')

# SASトークンの先頭の`?`を除去（URL結合時に付与するため）
$sasTokenClean = $sasToken.TrimStart('?')

# 管理者用完全URLの組み立て
$adminUrl = "${webEndpoint}/index.html?token=${sasTokenClean}"

# 結果出力
Write-Host ""
Write-Host "=== SASトークン生成完了 ===" -ForegroundColor Green
Write-Host "Storageアカウント: $StorageAccountName"
Write-Host "Policy: $PolicyName"
Write-Host ""
Write-Host "--- SASトークン ---"
Write-Host $sasToken
Write-Host ""
Write-Host "--- 管理者用URL ---"
Write-Host $adminUrl
Write-Host ""

# パイプライン出力用にURLを返す
Write-Output $adminUrl
