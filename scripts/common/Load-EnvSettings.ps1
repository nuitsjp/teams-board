<#
.SYNOPSIS
    .env ファイルから環境設定を読み込み、呼び出し元スコープに変数として設定する共通ヘルパー関数

.DESCRIPTION
    Import-EnvParams 関数を提供する。
    指定された .env ファイル（デフォルト: プロジェクトルートの .env）を読み込み、
    全キーを呼び出し元スコープの変数として設定する。
    .env.example に定義されたキーが .env に不足している場合はエラーで終了する。

    内部関数として Load-EnvSettings を使用し、.env ファイルのパースを行う。
#>

# 共通ログ関数の読み込み
. (Join-Path $PSScriptRoot "Write-Log.ps1")

function Load-EnvSettings {
    <#
    .SYNOPSIS
        .env ファイルを読み込み、キーと値のハッシュテーブルを返す

    .PARAMETER EnvPath
        .env ファイルのパス。未指定時はプロジェクトルートの .env を使用する。
        相対パスはプロジェクトルート基準で解決される。
    #>
    param(
        [string]$EnvPath = ""
    )

    # プロジェクトルートの算出（scripts/common → scripts → プロジェクトルート）
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

    # パス解決
    if ($EnvPath -eq "") {
        $resolvedPath = Join-Path $projectRoot ".env"
    } elseif ([System.IO.Path]::IsPathRooted($EnvPath)) {
        $resolvedPath = $EnvPath
    } else {
        $resolvedPath = Join-Path $projectRoot $EnvPath
    }

    # ファイル存在チェック
    if (-not (Test-Path $resolvedPath)) {
        throw (".env ファイルが見つかりません: $resolvedPath" + [Environment]::NewLine + ".env.example をコピーして .env を作成してください。")
    }

    $settings = @{}
    $lines = Get-Content -Path $resolvedPath -Encoding UTF8

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

    Write-Info ".env を読み込みました: $resolvedPath"
    return $settings
}

function Import-EnvParams {
    <#
    .SYNOPSIS
        .env ファイルを読み込み、全キーを呼び出し元スコープの変数として設定する

    .PARAMETER EnvPath
        .env ファイルのパス。未指定時はプロジェクトルートの .env を使用する。
        相対パスはプロジェクトルート基準で解決される。

    .DESCRIPTION
        1. Load-EnvSettings で .env を読み込む
        2. 全キーを Set-Variable -Scope 1 で呼び出し元スコープに設定
        3. .env.example のキー一覧と照合し、不足キーがあればエラー
    #>
    param(
        [string]$EnvPath = ""
    )

    # .env を読み込み
    $settings = Load-EnvSettings -EnvPath $EnvPath

    # 全キーを呼び出し元スコープに変数として設定
    foreach ($key in $settings.Keys) {
        Set-Variable -Name $key -Value $settings[$key] -Scope 1
    }

    # .env.example に基づく必須キー検証
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $examplePath = Join-Path $projectRoot ".env.example"

    if (Test-Path $examplePath) {
        $exampleLines = Get-Content -Path $examplePath -Encoding UTF8
        $requiredKeys = @()

        foreach ($line in $exampleLines) {
            if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
                continue
            }
            $eqIndex = $line.IndexOf("=")
            if ($eqIndex -gt 0) {
                $requiredKeys += $line.Substring(0, $eqIndex).Trim()
            }
        }

        $missingKeys = @()
        foreach ($reqKey in $requiredKeys) {
            if (-not $settings.ContainsKey($reqKey)) {
                $missingKeys += $reqKey
            }
        }

        if ($missingKeys.Count -gt 0) {
            throw (".env に必須キーが不足しています: $($missingKeys -join ', ')" + [Environment]::NewLine + ".env.example を確認し、不足キーを .env に追加してください。")
        }
    }
}
