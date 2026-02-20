import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Playwright でプレゼンテーション用スクリーンショットを取得する。
 * 事前に dev サーバー（pnpm run dev）を起動しておくこと。
 */
async function captureScreenshots() {
    const { chromium } = await import("@playwright/test");

    const outputDir = "docs/presentation/images";
    mkdirSync(outputDir, { recursive: true });

    const baseUrl = "http://localhost:5173/?token=dev#";

    /** @type {Array<{ name: string, path: string, waitForSelector: string }>} */
    const pages = [
        {
            name: "dashboard",
            path: "/",
            waitForSelector: "[data-testid='group-list'], .group-list, main",
        },
        {
            name: "csv-upload",
            path: "/admin",
            waitForSelector: "[data-testid='file-drop-zone'], .drop-zone, main",
        },
        {
            name: "group-detail",
            path: "/groups/01KHNHF98M86MWSATH6W4TR205",
            waitForSelector: "[data-testid='group-detail'], .recharts-wrapper, main",
        },
        {
            name: "member-detail",
            path: "/members/01KHNHF98NYNJPQV869R3WT90Y",
            waitForSelector: "[data-testid='member-detail'], .recharts-wrapper, main",
        },
    ];

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 2,
    });

    for (const page of pages) {
        const tab = await context.newPage();
        const url = `${baseUrl}${page.path}`;
        console.log(`キャプチャ中: ${page.name} (${url})`);

        await tab.goto(url, { waitUntil: "networkidle" });

        // セレクタのいずれかが表示されるまで待機
        const selectors = page.waitForSelector.split(", ");
        await Promise.race(
            selectors.map((s) => tab.waitForSelector(s, { timeout: 10000 }).catch(() => null))
        );

        // レンダリング安定化のため少し待機
        await tab.waitForTimeout(1000);

        const outputPath = path.join(outputDir, `${page.name}.png`);
        await tab.screenshot({ path: outputPath });
        console.log(`  保存: ${outputPath}`);

        await tab.close();
    }

    await browser.close();
    console.log("スクリーンショットの取得が完了しました。");
}

const isMain =
    process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
    captureScreenshots().catch((err) => {
        console.error("スクリーンショットの取得に失敗しました:", err);
        process.exit(1);
    });
}
