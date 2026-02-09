<#
.SYNOPSIS
    ログ出力用の共通関数

.DESCRIPTION
    スクリプト全体で統一されたログ出力を行うための共通関数群。
    呼び出し側は装飾を意識せずメッセージ内容だけを渡せばよい。
#>

function Write-Step {
    <#
    .SYNOPSIS
        セクション見出し・完了見出しを出力する
    #>
    param([Parameter(Mandatory)][string]$Title)
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Write-Action {
    <#
    .SYNOPSIS
        処理中の状態表示を出力する（Cyan色）
    #>
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Detail {
    <#
    .SYNOPSIS
        ラベル:値ペアの情報を整形して出力する
    #>
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Value
    )
    Write-Host "  ${Label}: $Value"
}

function Write-Info {
    <#
    .SYNOPSIS
        自由形式の情報をプレーンテキストで出力する
    #>
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message
}

function Write-Success {
    <#
    .SYNOPSIS
        成功・完了メッセージを出力する（Green色）
    #>
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
    <#
    .SYNOPSIS
        警告・スキップ通知を出力する（Yellow色）
    #>
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}
