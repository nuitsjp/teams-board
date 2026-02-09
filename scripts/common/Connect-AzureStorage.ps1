<#
.SYNOPSIS
    Azure Storageアカウントへの接続共通関数

.DESCRIPTION
    Azureサブスクリプション切替・Storageアカウント接続確認・アカウントキー取得を
    一括で実行する共通関数。各インフラスクリプトからドットソースで呼び出して使用する。
#>

# 共通ログ関数の読み込み
. (Join-Path $PSScriptRoot "Write-Log.ps1")

function Connect-AzureStorage {
    <#
    .SYNOPSIS
        Azure Storageアカウントに接続し、アカウントキーを返す

    .PARAMETER SubscriptionId
        対象のAzureサブスクリプションID

    .PARAMETER ResourceGroupName
        リソースグループ名

    .PARAMETER StorageAccountName
        Storageアカウント名

    .OUTPUTS
        Storageアカウントのアカウントキー（文字列）
    #>
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$StorageAccountName
    )

    # サブスクリプション切替
    Write-Detail "対象サブスクリプション" $SubscriptionId
    Write-Action "サブスクリプションを切り替えています..."
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) { throw "サブスクリプションの切り替えに失敗しました" }
    Write-Success "サブスクリプションを切り替えました"

    # Storageアカウントの接続確認
    Write-Action "Storageアカウント '$StorageAccountName' に接続しています..."
    az storage account show --resource-group $ResourceGroupName --name $StorageAccountName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Storageアカウント '$StorageAccountName' が見つかりません" }

    # アカウントキーを取得
    $accountKey = (az storage account keys list --resource-group $ResourceGroupName --account-name $StorageAccountName --query "[0].value" --output tsv)
    if ($LASTEXITCODE -ne 0) { throw "Storageアカウントキーの取得に失敗しました" }
    Write-Success "Storageアカウントに接続しました"

    return $accountKey
}
