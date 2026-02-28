import { formatDuration } from '../../../../src/utils/format-duration.js';

describe('formatDuration', () => {
  it('0秒を「0分」と表示すること', () => {
    expect(formatDuration(0)).toBe('0分');
  });

  it('秒のみの値を「X分」と表示すること', () => {
    expect(formatDuration(300)).toBe('5分');
  });

  it('時間を含む値を「X時間Y分」と表示すること', () => {
    expect(formatDuration(3660)).toBe('1時間1分');
  });

  it('複数時間の値を正しくフォーマットすること', () => {
    expect(formatDuration(7200)).toBe('2時間0分');
  });

  it('秒の端数を切り捨てること', () => {
    expect(formatDuration(3661)).toBe('1時間1分');
  });
});
