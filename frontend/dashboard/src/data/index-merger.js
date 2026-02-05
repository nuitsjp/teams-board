// IndexMerger — index.jsonのマージロジック
export class IndexMerger {
  /**
   * 既存indexに新規アイテムをマージする
   * @param {object} currentIndex - 現在のDashboardIndex
   * @param {Array} newItems - 追加するDashboardItem配列
   * @returns {{ items: Array, updatedAt: string, warnings: string[] }}
   */
  merge(currentIndex, newItems) {
    const warnings = [];
    const existingIds = new Set(currentIndex.items.map((item) => item.id));

    // 重複チェック
    const uniqueNewItems = [];
    for (const item of newItems) {
      if (existingIds.has(item.id)) {
        warnings.push(`重複ID検出: ${item.id} は既に存在します`);
      } else {
        uniqueNewItems.push(item);
      }
    }

    return {
      items: [...currentIndex.items, ...uniqueNewItems],
      updatedAt: new Date().toISOString(),
      warnings,
    };
  }
}
