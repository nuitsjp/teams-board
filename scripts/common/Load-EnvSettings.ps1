<#
.SYNOPSIS
    .env ファイルから環境固有の設定を読み込む共通ヘルパー関数

.DESCRIPTION
    プロジェクトルートの .env ファイルを読み込み、キーと値のハッシュテーブルを返す。
    ファイルが存在しない場合は $null を返す。
    各インフラスクリプトからドットソースで呼び出して使用する。
#>

# 共通ログ関数の読み込み
. (Join-Path $PSScriptRoot "Write-Log.ps1")

function Load-EnvSettings {
    # スクリプト位置から2階層上がプロジェクトルート（scripts/common → プロジェクトルート）
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $envPath = Join-Path $projectRoot ".env"

    if (Test-Path $envPath) {
        $settings = @{}
        $lines = Get-Content -Path $envPath -Encoding UTF8

        foreach ($line in $lines) {
            # 空行とコメント行をスキップ
            if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
                continue
            }

            # KEY=VALUE 形式をパース
            $eqIndex = $line.IndexOf("=")
            if ($eqIndex -gt 0) {
                $key = $line.Substring(0, $eqIndex).Trim()
                $value = $line.Substring($eqIndex + 1).Trim()

                # クォートの除去（ダブルクォートまたはシングルクォート）
                if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                    $value = $value.Substring(1, $value.Length - 2)
                }

                $settings[$key] = $value
            }
        }

        Write-Info ".env を読み込みました: $envPath"
        return $settings
    }

    return $null
}

function Apply-EnvSettings {
    <#
    .SYNOPSIS
        .env の値を、コマンドライン引数で明示指定されていないパラメータに適用する

    .PARAMETER Settings
        Load-EnvSettings で読み込んだ設定ハッシュテーブル

    .PARAMETER BoundParameters
        呼び出し元スクリプトの $PSBoundParameters

    .PARAMETER ParameterMap
        PowerShellパラメータ名 → .env 変数名のマッピング（ハッシュテーブル）

    .OUTPUTS
        適用された設定値のハッシュテーブル（パラメータ名 → 値）
    #>
    param(
        [hashtable]$Settings,
        [hashtable]$BoundParameters,
        [hashtable]$ParameterMap
    )

    $result = @{}

    if ($null -eq $Settings) {
        return $result
    }

    foreach ($paramName in $ParameterMap.Keys) {
        $envKey = $ParameterMap[$paramName]

        # コマンドライン引数で明示指定されていない場合のみ上書き
        if (-not $BoundParameters.ContainsKey($paramName)) {
            $value = $Settings[$envKey]
            if ($null -ne $value -and $value -ne "") {
                $result[$paramName] = $value
            }
        }
    }

    return $result
}
