// ANSIエスケープコード
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/** セクション見出しを出力する（Cyan色） */
export function writeStep(title) {
  console.log(`\n${CYAN}=== ${title} ===${RESET}`);
}

/** 処理中の状態表示を出力する（Cyan色） */
export function writeAction(message) {
  console.log(`${CYAN}${message}${RESET}`);
}

/** ラベル:値ペアの情報を整形して出力する */
export function writeDetail(label, value) {
  console.log(`  ${label}: ${value}`);
}

/** 自由形式の情報をプレーンテキストで出力する */
export function writeInfo(message) {
  console.log(message);
}

/** 成功・完了メッセージを出力する（Green色） */
export function writeSuccess(message) {
  console.log(`${GREEN}${message}${RESET}`);
}

/** 警告・スキップ通知を出力する（Yellow色） */
export function writeWarn(message) {
  console.log(`${YELLOW}${message}${RESET}`);
}
