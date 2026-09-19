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
        <div class="nav-notify">
          <button id="nav-notify-btn" class="nav-link nav-bell" aria-label="通知" type="button">
            🔔<span class="notify-badge" id="notify-badge" hidden>0</span>
          </button>
          <div class="notify-panel" id="notify-panel"></div>
        </div>
        <button id="nav-logout" class="nav-link nav-logout">ログアウト</button>
      </div>
    </div>
  `;

  document.getElementById("nav-logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });

  initNotifications();
}

async function initNotifications() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  const btn = document.getElementById("nav-notify-btn");
  const badge = document.getElementById("notify-badge");
  const panel = document.getElementById("notify-panel");

  async function refreshBadge() {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (count && count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  async function openPanel() {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, part, is_read, created_at, actor:profiles!notifications_actor_id_fkey(display_name), bands(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      panel.innerHTML = `<div class="notify-empty">通知の読み込みに失敗しました。</div>`;
      panel.classList.add("open");
      return;
    }

    panel.innerHTML =
      data && data.length > 0
        ? data
            .map(
              (n) => `
          <div class="notify-item ${n.is_read ? "" : "unread"}">
            <div class="notify-text">
              <strong>${escapeHtml(n.actor?.display_name ?? "不明")}</strong>さんが「${escapeHtml(n.bands?.title ?? "投稿")}」の<strong>${escapeHtml(n.part)}</strong>にリアクションしました
            </div>
            <div class="notify-time">${formatRelativeTime(n.created_at)}</div>
          </div>
        `
            )
            .join("")
        : `<div class="notify-empty">通知はまだありません。</div>`;

    panel.classList.add("open");

    const unreadIds = (data || []).filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      refreshBadge();
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.classList.contains("open")) {
      panel.classList.remove("open");
    } else {
      openPanel();
    }
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
    }
  });

  refreshBadge();
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
