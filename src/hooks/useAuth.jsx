import { createContext, useContext, useState, useEffect } from 'react';

/**
 * 認証状態の型: { sasToken: string|null, isAdmin: boolean }
 */
const AuthContext = createContext({ sasToken: null, isAdmin: false });

/**
 * SASトークンのパラメータ名一覧（sig が含まれていれば SAS とみなす）
 */
const SAS_PARAMS = ['sv', 'sr', 'si', 'sig', 'spr', 'se', 'sp', 'sdd', 'sip', 'srt', 'ss', 'st'];

/**
 * URLクエリパラメータからSASトークンを抽出する
 *
 * 対応URL形式:
 *   1. ?token=<URLエンコード済みSASトークン>
 *   2. ?sv=...&si=...&sr=...&sig=... （SASパラメータが直接展開された形式）
 *
 * @returns {{ sasToken: string|null, isAdmin: boolean }}
 */
function extractAuth() {
  const url = new URL(window.location.href);

  // 形式1: ?token=<encoded-sas> を優先
  const token = url.searchParams.get('token');
  if (token) {
    url.searchParams.delete('token');
    const cleanUrl = url.searchParams.toString()
      ? `${url.origin}${url.pathname}?${url.searchParams.toString()}${url.hash}`
      : `${url.origin}${url.pathname}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);
    return { sasToken: token, isAdmin: true };
  }

  // 形式2: SASパラメータが直接URLに含まれている場合
  if (url.searchParams.has('sig')) {
    const sasEntries = [];
    const removeKeys = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (SAS_PARAMS.includes(key)) {
        sasEntries.push(`${key}=${encodeURIComponent(value)}`);
        removeKeys.push(key);
      }
    }
    const sasToken = sasEntries.join('&');

    // URLからSASパラメータを除去（セキュリティ）
    for (const key of removeKeys) {
      url.searchParams.delete(key);
    }
    const cleanUrl = url.searchParams.toString()
      ? `${url.origin}${url.pathname}?${url.searchParams.toString()}${url.hash}`
      : `${url.origin}${url.pathname}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);

    return { sasToken, isAdmin: true };
  }

  return { sasToken: null, isAdmin: false };
}

/**
 * 認証状態を提供するProvider
 */
export function AuthProvider({ children }) {
  const [auth] = useState(() => extractAuth());

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 認証状態を取得するカスタムHook
 * @returns {{ sasToken: string|null, isAdmin: boolean }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * 認証情報からBlobWriter互換のauthオブジェクトを生成する
 * @param {{ sasToken: string|null }} auth
 * @returns {{ getSasToken: () => string|null, isAdminMode: () => boolean }}
 */
export function createAuthAdapter(auth) {
  return {
    getSasToken: () => auth.sasToken,
    isAdminMode: () => auth.sasToken !== null,
  };
}
