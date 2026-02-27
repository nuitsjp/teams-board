/**
 * ブラウザ履歴が存在する場合は前のページに戻り、
 * 存在しない場合はダッシュボード（/）にフォールバックする。
 *
 * react-router-dom が history.state.idx に現在の履歴インデックスを格納しており、
 * idx === 0 は直接アクセス（ブックマーク・外部リンク・リロード）を意味する。
 */
export function navigateBack(navigate) {
    if (window.history.state?.idx > 0) {
        navigate(-1);
    } else {
        navigate('/');
    }
}
