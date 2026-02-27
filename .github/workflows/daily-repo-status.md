---
description: |
    このワークフローは、リポジトリの日次ステータスレポートを作成します。
    リポジトリの最近のアクティビティ（issue、プルリクエスト、ディスカッション、リリース、コード変更）を収集し
    生産性に関する洞察、コミュニティのハイライト、プロジェクトの推奨事項を含む魅力的なGitHub Issueを生成します。

on:
  schedule: daily
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

network: defaults

tools:
  github:
    # If in a public repo, setting `lockdown: false` allows
    # reading issues, pull requests and comments from 3rd-parties
    # If in a private repo this has no particular effect.
    lockdown: false

safe-outputs:
  create-issue:
    title-prefix: "[repo-status] "
    labels: [report, daily-status]
source: githubnext/agentics/workflows/daily-repo-status.md@5791ed997f23fafeb1b9f90433ac6e4f44bdebc2
engine: copilot
---

# 日報（リポジトリの状況）

GitHubのIssueとして、リポジトリの状況について日報を明るく前向きなトーンで作成してください。

## 含めるべき内容

* 最近のリポジトリでの活動（Issue、PR、ディスカッション、リリース、コード変更）
* 進捗トラッキング、目標のリマインダーとハイライト
* プロジェクトの現状と推奨事項
* メンテナー向けの実用的な次のステップ

## スタイル

* ポジティブで、励まし、役立つ内容にすること 🌟
* 読者の興味を引くために適度に絵文字を使用すること
* 簡潔にまとめること – 実際の活動に基づいて長さを調整すること

## プロセス

1. リポジトリから最近の活動を収集する
2. リポジトリ、そのIssue、プルリクエストを調査する
3. 調査結果と洞察をまとめた新しいGitHub Issueを作成する
