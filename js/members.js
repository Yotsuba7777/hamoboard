import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const user = await requireAuth();
if (user) {
  renderNav("members");
  loadMembers();
}

const listEl = document.getElementById("member-list");

async function loadMembers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    listEl.innerHTML = `<p class="empty-state">読み込みに失敗しました。時間をおいて再度お試しください。</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="empty-state">まだメンバーが登録されていません。</p>`;
    return;
  }

  listEl.innerHTML = data.map(renderMemberCard).join("");
}

function renderMemberCard(m) {
  const initial = (m.display_name || "?").charAt(0);
  return `
    <div class="member-card">
      <div class="member-head">
        <div class="avatar">${escapeHtml(initial)}</div>
        <div>
          <div class="member-name">${escapeHtml(m.display_name)}${m.grade ? `（${escapeHtml(m.grade)}）` : ""}</div>
          <div class="member-part">パート：${escapeHtml(m.part || "未設定")}</div>
        </div>
      </div>
      ${m.bio ? `<div class="member-bio">${escapeHtml(m.bio)}</div>` : `<div class="member-bio">まだひとことコメントが登録されていません。</div>`}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
