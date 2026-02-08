import { createContext, useContext, useState, useEffect } from 'react';

/**
 * 認証状態の型: { sasToken: string|null, isAdmin: boolean }
 */
const AuthContext = createContext({ sasToken: null, isAdmin: false });

/**
 * URLクエリパラメータからSASトークンを抽出する
 * @returns {{ sasToken: string|null, isAdmin: boolean }}
 */
function extractAuth() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');

  if (!token) {
    return { sasToken: null, isAdmin: false };
  }

  // URLからtokenパラメータを除去（セキュリティ）
  url.searchParams.delete('token');
  const cleanUrl = url.searchParams.toString()
    ? `${url.origin}${url.pathname}?${url.searchParams.toString()}${url.hash}`
    : `${url.origin}${url.pathname}${url.hash}`;
  window.history.replaceState(null, '', cleanUrl);

  return { sasToken: token, isAdmin: true };
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
