import { supabase } from "./supabase-client.js";

// ログインしていなければlogin.htmlへ飛ばす。ログイン中ならユーザー情報を返す。
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

// 上部ナビゲーションを #nav-root に描画する
export function renderNav(activePage) {
  const root = document.getElementById("nav-root");
  if (!root) return;

  const links = [
    { href: "index.html", label: "掲示板", key: "board" },
    { href: "members.html", label: "メンバー紹介", key: "members" },
    { href: "profile.html", label: "マイページ", key: "profile" },
  ];

  root.innerHTML = `
    <div class="nav-inner">
      <a class="nav-logo" href="index.html">ハモ<span>ボード</span></a>
      <div class="nav-links">
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="nav-link${l.key === activePage ? " active" : ""}">${l.label}</a>`
          )
          .join("")}
        <button id="nav-logout" class="nav-link nav-logout">ログアウト</button>
      </div>
    </div>
  `;

  document.getElementById("nav-logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}
