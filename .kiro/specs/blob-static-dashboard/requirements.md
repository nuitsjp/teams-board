# Requirements Document

## Introduction

Azure Blob Storage Static website（`$web`）を活用し、ダッシュボード／ドリルダウン閲覧を提供する静的サイトを構築する。閲覧はバックエンド不要の静的配信で完結し、データ更新はCSVをブラウザ上でJSONに変換してBlobへPUTする方式を採る。アクセス制御は閉域ネットワーク＋SASトークンで簡易に分離する。

## Requirements

### Requirement 1: ダッシュボード閲覧
**Objective:** 一般ユーザーとして、ダッシュボード画面でデータの一覧・集約を閲覧したい。バックエンド依存なく高速に表示されることで、低頻度アクセスでも安定したUXを得られる。

#### Acceptance Criteria
1. When ユーザーが `index.html` を開いた時, the Static Dashboard shall `data/index.json` を取得してダッシュボード一覧をレンダリングする
2. The Static Dashboard shall バックエンドAPI呼び出しなしに、静的ファイルのみで画面を表示する
3. While `data/index.json` の取得中, the Static Dashboard shall ローディング状態を表示する
4. If `data/index.json` の取得に失敗した場合, the Static Dashboard shall エラーメッセージを表示する

### Requirement 2: ドリルダウン詳細閲覧
**Objective:** 一般ユーザーとして、一覧からアイテムを選択して詳細情報を閲覧したい。ドリルダウンにより必要な情報へ素早くアクセスできる。

#### Acceptance Criteria
1. When ユーザーがダッシュボード一覧のアイテムを選択した時, the Static Dashboard shall 対応する `data/items/<id>.json` を取得して詳細画面を表示する
2. When 詳細画面で「戻る」操作を行った時, the Static Dashboard shall ダッシュボード一覧画面に戻る
3. If 詳細JSONの取得に失敗した場合, the Static Dashboard shall エラーメッセージを表示し、一覧画面へ戻る手段を提供する

### Requirement 3: 管理者認証（SASトークン）
**Objective:** 管理者として、SASトークン付きURLでアクセスすることで更新権限を得たい。一般ユーザーと管理者を簡易的に分離できる。

#### Acceptance Criteria
1. When URLのクエリパラメータ `token` にSASトークンが含まれている場合, the Static Dashboard shall SASトークンを取得して管理者モードを有効にする
2. When 管理者モードが有効化された時, the Static Dashboard shall `history.replaceState` でURLからtokenパラメータを除去する
3. While 管理者モードが有効な場合, the Static Dashboard shall 管理者向けUI（CSV投入・更新機能）を表示する
4. While 管理者モードが無効な場合（SASトークンなし）, the Static Dashboard shall 管理者向けUIを非表示にする

### Requirement 4: CSVアップロードと変換
**Objective:** 管理者として、CSVファイルを投入してダッシュボード用JSONを生成したい。手作業の登録を避け、更新を省力化できる。

#### Acceptance Criteria
1. While 管理者モードが有効な場合, when CSVファイルがファイル選択またはDrag&Dropで投入された時, the Static Dashboard shall CSVをブラウザ上でパースする
2. When CSVパースが完了した時, the Static Dashboard shall 配信用JSON（`data/index.json` 形式）に変換する
3. When CSV変換が完了した時, the Static Dashboard shall 変換結果のプレビューを管理者に表示する
4. If CSVのフォーマットが不正な場合, the Static Dashboard shall パースエラーの詳細を表示し、アップロードを中断する

### Requirement 5: Blob Storageへのデータ書き込み
**Objective:** 管理者として、変換したJSONとCSV元データをBlob Storageに保存したい。データの更新と保管を一度の操作で完了できる。書き込み順序を制御し、`index.json` は常に最新状態をベースに更新することでデータ不整合を防ぐ。

#### Acceptance Criteria
1. When 管理者がデータ保存を確定した時, the Static Dashboard shall 以下の順序で書き込みを実行する：(1) `raw/<timestamp>-<name>.csv`、(2) `data/items/<id>.json`、(3) `data/index.json`（indexは最後）
2. When `data/index.json` の書き込み直前, the Static Dashboard shall Blobサービスエンドポイントから最新の `data/index.json` を取得し、その内容をベースにマージ・更新した上でPUTする
3. Where 詳細JSONの追加が必要な場合, the Static Dashboard shall 新規の `data/items/<id>.json` を `data/index.json` より先にBlobサービスエンドポイントにPUTする（既存itemsの上書きは行わない）
4. Where 元CSV保管が有効な場合, the Static Dashboard shall `raw/<timestamp>-<name>.csv` を最初にBlobサービスエンドポイントにPUTする
5. When すべてのPUTが成功した時, the Static Dashboard shall 更新完了メッセージを表示する
6. If いずれかのPUTが失敗した場合, the Static Dashboard shall エラー内容を表示し、失敗した操作を特定できるようにする
7. If `data/index.json` の最新取得に失敗した場合, the Static Dashboard shall エラーを表示し、書き込みを中断する

### Requirement 6: キャッシュ制御
**Objective:** 一般ユーザーとして、常に最新の一覧データを閲覧しつつ、不変の詳細データはキャッシュを活用して高速に表示したい。

#### Acceptance Criteria
1. When `data/index.json` を取得する時, the Static Dashboard shall キャッシュバスター（例: `?v=<timestamp>`）を付与してリクエストする
2. The Static Dashboard shall `data/items/<id>.json` は不変リソースとして扱い、ブラウザキャッシュを有効にする（キャッシュバスターを付与しない）
3. The Static Dashboard shall `data/items/` 配下のファイルは追加のみとし、既存ファイルの上書き更新は行わない

### Requirement 7: エラーハンドリングとリカバリ
**Objective:** 管理者として、更新操作の失敗時に状況を把握し復旧できるようにしたい。データ不整合のリスクを最小化できる。

#### Acceptance Criteria
1. If Blobへの書き込み中にネットワークエラーが発生した場合, the Static Dashboard shall リトライ可能な操作にはリトライボタンを提供する
2. While データ書き込み処理中, the Static Dashboard shall 進捗状態（処理中のファイル名等）を表示する
3. If 複数ファイルの書き込みで一部のみ成功した場合, the Static Dashboard shall 成功/失敗したファイルの一覧を表示する

### Requirement 8: 非機能要件（性能・UX）
**Objective:** 全ユーザーとして、快適で安定したサイト利用体験を得たい。低頻度アクセスでも遅延なく利用できる。

#### Acceptance Criteria
1. The Static Dashboard shall サーバサイドのバックエンドプロセスに依存せず、静的ファイル配信のみで閲覧機能を提供する
2. The Static Dashboard shall JavaScript・CSS・HTMLのみで構成され、ビルド後の成果物は `$web` コンテナに配置可能な静的ファイルとする
3. While CSVファイルの処理中, the Static Dashboard shall ブラウザのUIスレッドをブロックしない（大規模CSV対応）

## Project Description (Input)
# Blob AccountによるStatic Web Site構築

## 背景

* ダッシュボード／ドリルダウン閲覧を提供する静的サイトを運用したい。
* 利用頻度が低く、常時稼働のDBやバックエンドを置くのはコスト・運用負荷に見合わない。
* 閲覧時UXを損ねたくない（バックエンド待ちやコールドスタートを避けたい）。
* 更新情報はCSVで与えられ、手作業の登録（Issue等）は避けたい。
* Azure Functions は配置ポリシー上 App Service プランのみで安価に使いづらい。
* 環境は専用線により閉域接続が成立しており、イントラ内からのみ利用する前提が取れる。
* 取り扱うデータは機密性が高くなく、SASのURL漏洩は重大問題としない（ただし過度な複雑化は避けたい）。

## 目的

1. **閲覧の安定UX**：静的配信のみで完結し、低頻度アクセスでも高速
2. **最小コスト／最小運用**：DB/常時稼働APIを持たない
3. **更新の省力化**：CSV投入→クライアント側で変換→JSON更新で反映
4. **シンプルな権限制御**：一般ユーザーは読み取りのみ、管理者は書き込み可能（SASで簡易分離）

## アーキテクチャ概要

* ホスティング：**Azure Blob Storage Static website（$web）**
* 更新処理：**ブラウザJavaScriptのみ**
* アクセス制御：**閉域（専用線）＋Storageネットワーク規則**を基本境界とする
