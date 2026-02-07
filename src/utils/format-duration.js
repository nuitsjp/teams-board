/**
 * 秒数を「X時間Y分」形式にフォーマットする
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
}
