// CDP経由でページの#app内容とコンソールエラーを取得（一時ファイル）
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:9222/devtools/page/426CEA0C791606A51F7716D764B48CFB';

async function main() {
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let msgId = 0;
  const pending = new Map();

  function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  // #app の innerHTML を取得
  const evalResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.getElementById('app');
      if (!app) return 'ERROR: #app not found';
      const html = app.innerHTML;
      return 'Length: ' + html.length + '\\n' + html.substring(0, 3000);
    })()`
  });

  console.log('=== #app 内容 ===');
  console.log(evalResult.result?.result?.value || JSON.stringify(evalResult.result));

  // ページ状態
  const stateResult = await send('Runtime.evaluate', {
    expression: `document.title + ' | readyState: ' + document.readyState`
  });
  console.log('\n=== ページ状態 ===');
  console.log(stateResult.result?.result?.value);

  // エラーログキャプチャ
  await send('Log.enable');
  await send('Console.enable');
  await send('Runtime.enable');

  const errors = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Console.messageAdded' && msg.params?.message?.level === 'error') {
      errors.push('[Console] ' + msg.params.message.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      errors.push('[Log] ' + (msg.params.entry.text || msg.params.entry.url));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const detail = msg.params.exceptionDetails;
      errors.push('[Exception] ' + (detail?.exception?.description || detail?.text));
    }
  });

  // リロード
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 4000));

  console.log('\n=== リロード後のエラー ===');
  if (errors.length === 0) {
    console.log('(エラーなし)');
  } else {
    for (const e of errors) console.log(e);
  }

  // リロード後の#app
  const reloadResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.getElementById('app');
      if (!app) return 'ERROR: #app not found';
      const html = app.innerHTML;
      return 'Length: ' + html.length + '\\n' + html.substring(0, 3000);
    })()`
  });

  console.log('\n=== リロード後の#app内容 ===');
  console.log(reloadResult.result?.result?.value || JSON.stringify(reloadResult.result));

  ws.close();
}

main().catch(console.error);
