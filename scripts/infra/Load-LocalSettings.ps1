<#
.SYNOPSIS
    local.settings.json から環境固有の設定を読み込む共通ヘルパー関数

.DESCRIPTION
    プロジェクトルートの local.settings.json を読み込み、設定オブジェクトを返す。
    ファイルが存在しない場合は $null を返す。
    各インフラスクリプトからドットソースで呼び出して使用する。
#>

function Load-LocalSettings {
    # スクリプト位置から2階層上がプロジェクトルート（scripts/infra → プロジェクトルート）
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $settingsPath = Join-Path $projectRoot "local.settings.json"

    if (Test-Path $settingsPath) {
        $content = Get-Content -Path $settingsPath -Raw -Encoding UTF8
        $settings = $content | ConvertFrom-Json
        Write-Host "local.settings.json を読み込みました: $settingsPath" -ForegroundColor DarkGray
        return $settings
    }

    return $null
}

function Apply-LocalSettings {
    <#
    .SYNOPSIS
        local.settings.json の値を、コマンドライン引数で明示指定されていないパラメータに適用する

    .PARAMETER Settings
        Load-LocalSettings で読み込んだ設定オブジェクト

    .PARAMETER BoundParameters
        呼び出し元スクリプトの $PSBoundParameters

    .PARAMETER ParameterMap
        PowerShellパラメータ名 → JSON キー名のマッピング（ハッシュテーブル）

    .OUTPUTS
        適用された設定値のハッシュテーブル（パラメータ名 → 値）
    #>
    param(
        [object]$Settings,
        [hashtable]$BoundParameters,
        [hashtable]$ParameterMap
    )

    $result = @{}

    if ($null -eq $Settings) {
        return $result
    }

    foreach ($paramName in $ParameterMap.Keys) {
        $jsonKey = $ParameterMap[$paramName]

        # コマンドライン引数で明示指定されていない場合のみ上書き
        if (-not $BoundParameters.ContainsKey($paramName)) {
            $value = $Settings.$jsonKey
            if ($null -ne $value -and $value -ne "") {
                $result[$paramName] = $value
            }
        }
    }

    return $result
}
