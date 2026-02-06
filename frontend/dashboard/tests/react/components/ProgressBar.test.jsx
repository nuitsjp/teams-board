import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../../../src/components/ProgressBar.jsx';

describe('ProgressBar', () => {
  it('visible=falseの場合に何も表示しないこと', () => {
    const { container } = render(
      <ProgressBar current={0} total={3} visible={false} statusText="" />
    );
    expect(container.querySelector('.save-progress')).toBeNull();
  });

  it('visible=trueの場合にプログレスバーを表示すること', () => {
    const { container } = render(
      <ProgressBar current={1} total={3} visible={true} statusText="保存中..." />
    );
    expect(container.querySelector('.save-progress')).not.toBeNull();
    expect(screen.getByText('保存中...')).toBeInTheDocument();
  });

  it('進捗値が正しく設定されること', () => {
    const { container } = render(
      <ProgressBar current={2} total={5} visible={true} statusText="" />
    );
    const progress = container.querySelector('progress');
    expect(progress.value).toBe(2);
    expect(progress.max).toBe(5);
  });
});
