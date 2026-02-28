import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../../../../src/components/ProgressBar.jsx';

describe('ProgressBar', () => {
  it('visible=falseの場合に何も表示しないこと', () => {
    const { container } = render(
      <ProgressBar current={0} total={3} visible={false} statusText="" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('visible=trueの場合にプログレスバーを表示すること', () => {
    render(<ProgressBar current={1} total={3} visible={true} statusText="保存中..." />);
    expect(screen.getByText(/保存中\.\.\./)).toBeInTheDocument();
  });

  it('進捗値が正しく設定されること', () => {
    render(<ProgressBar current={2} total={5} visible={true} statusText="" />);
    // divベースのプログレスバー: width: 40%
    expect(screen.getByText(/40%/)).toBeInTheDocument();
  });

  it('totalが0の場合にpercentageが0%となること', () => {
    render(<ProgressBar current={0} total={0} visible={true} statusText="準備中..." />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });
});
