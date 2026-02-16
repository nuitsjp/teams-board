// 異なる期のサンプル CSV ファイルを生成するスクリプト
// 2024年度 下期、2025年度 上期 のデータを追加する
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const csvDir = join(__dirname, '../csv');

// メンバー情報（既存の id-mappings.json と同一）
const members = {
    suzuki: { name: 'Suzuki Taro A (鈴木 太郎)', email: 'suzuki.taro.a@example.com' },
    tanaka: { name: 'Tanaka Koji (田中 浩二)', email: 'tanaka.koji@example.com' },
    yamamoto: { name: 'Yamamoto Yuki A (山本 裕貴)', email: 'yamamoto.yuki.a@example.com' },
    watanabe: { name: 'Watanabe Kenji (渡辺 健二)', email: 'watanabe.kenji@example.com' },
    sato: { name: 'Sato Ichiro (佐藤 一郎)', email: 'sato.ichiro@example.com' },
};

// 秒数を「X 時間 Y 分 Z 秒」形式に変換
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} 時間`);
    if (minutes > 0) parts.push(`${minutes} 分`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} 秒`);

    return parts.join(' ');
}

// 日付を「YYYY/M/D HH:MM:SS」形式に変換
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${year}/${parseInt(month)}/${parseInt(day)} 19:00:00`;
}

// CSV コンテンツを生成
function generateCSV(groupName, date, attendees) {
    const startTime = formatDate(date);

    const section1 = [
        '1. 要約',
        `会議のタイトル\t${groupName}`,
        `開始時刻\t${startTime}`,
        '',
    ].join('\n');

    const participantRows = attendees.map(
        (a) => `${a.name}\t${a.email}\t${formatDuration(a.durationSeconds)}`
    );

    const section2 = [
        '2. 参加者',
        '名前\tメール アドレス\t会議の長さ',
        ...participantRows,
        '',
    ].join('\n');

    const section3 = '3. 会議中のアクティビティ\n';

    return section1 + section2 + section3;
}

// セッション定義: 異なる期のデータ
const sessions = [
    // === 2024年度 下期 (2024-10 〜 2025-03) ===
    {
        groupName: 'フロントエンド勉強会',
        date: '2024-10-16',
        attendees: [
            { ...members.suzuki, durationSeconds: 3480 },
            { ...members.tanaka, durationSeconds: 2700 },
            { ...members.yamamoto, durationSeconds: 3120 },
        ],
    },
    {
        groupName: 'フロントエンド勉強会',
        date: '2024-12-18',
        attendees: [
            { ...members.suzuki, durationSeconds: 3600 },
            { ...members.yamamoto, durationSeconds: 3300 },
        ],
    },
    {
        groupName: 'TypeScript読書会',
        date: '2025-01-14',
        attendees: [
            { ...members.suzuki, durationSeconds: 5400 },
            { ...members.tanaka, durationSeconds: 4800 },
            { ...members.yamamoto, durationSeconds: 5100 },
        ],
    },
    {
        groupName: 'ソフトウェア設計勉強会',
        date: '2025-02-19',
        attendees: [
            { ...members.suzuki, durationSeconds: 3900 },
            { ...members.watanabe, durationSeconds: 3600 },
            { ...members.sato, durationSeconds: 2400 },
        ],
    },

    // === 2025年度 上期 (2025-04 〜 2025-09) ===
    {
        groupName: 'フロントエンド勉強会',
        date: '2025-04-16',
        attendees: [
            { ...members.suzuki, durationSeconds: 3540 },
            { ...members.tanaka, durationSeconds: 3000 },
            { ...members.yamamoto, durationSeconds: 3360 },
        ],
    },
    {
        groupName: 'TypeScript読書会',
        date: '2025-06-10',
        attendees: [
            { ...members.suzuki, durationSeconds: 5580 },
            { ...members.tanaka, durationSeconds: 4500 },
        ],
    },
    {
        groupName: 'インフラ技術研究会',
        date: '2025-07-23',
        attendees: [
            { ...members.tanaka, durationSeconds: 3300 },
            { ...members.yamamoto, durationSeconds: 2700 },
            { ...members.watanabe, durationSeconds: 3000 },
        ],
    },
    {
        groupName: 'ソフトウェア設計勉強会',
        date: '2025-09-17',
        attendees: [
            { ...members.suzuki, durationSeconds: 4200 },
            { ...members.watanabe, durationSeconds: 3900 },
            { ...members.sato, durationSeconds: 3000 },
        ],
    },
];

console.log(`${sessions.length} 件のサンプル CSV を生成します...\n`);

for (const session of sessions) {
    const csvContent = generateCSV(session.groupName, session.date, session.attendees);
    const csvFileName = `${session.groupName}-${session.date}.csv`;
    const csvPath = join(csvDir, csvFileName);

    // UTF-16LE エンコーディングで保存（BOM 付き）
    const buffer = Buffer.from('\ufeff' + csvContent, 'utf16le');
    writeFileSync(csvPath, buffer);

    console.log(`✓ ${csvFileName}`);
}

console.log(`\n完了: ${sessions.length} 件の CSV ファイルを生成しました`);
