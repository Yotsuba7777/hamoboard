import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const listEl = document.getElementById("member-list");

const user = await requireAuth();
if (user) {
  renderNav("members");
  loadMembers();
}

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

const MOTIVATION_CLASS = {
  "とても参加したい": "motivation-1",
  "参加したい": "motivation-2",
  "忙しいけど可能": "motivation-3",
  "難しい": "motivation-4",
};

function renderMemberCard(m) {
  const initial = (m.display_name || "?").charAt(0);
  const parts = (m.parts && m.parts.length > 0) ? m.parts.join(" / ") : "未設定";
  const motivationClass = MOTIVATION_CLASS[m.motivation] || "";
  const gradeLabel = formatGradeLabel(m);
  return `
    <div class="member-card">
      <div class="member-head">
        <div class="avatar">${escapeHtml(initial)}</div>
        <div>
          <div class="member-name">${escapeHtml(m.display_name)}${gradeLabel}</div>
          <div class="member-part">パート：${escapeHtml(parts)}</div>
          ${m.favorite_artist ? `<div class="member-artist">好きなアーティスト：${escapeHtml(m.favorite_artist)}</div>` : ""}
        </div>
      </div>
      ${m.motivation ? `<span class="motivation-badge ${motivationClass}">${escapeHtml(m.motivation)}</span>` : ""}
      ${m.bio ? `<div class="member-bio">${escapeHtml(m.bio)}</div>` : `<div class="member-bio">まだひとことコメントが登録されていません。</div>`}
    </div>
  `;
}

function formatGradeLabel(m) {
  if (m.period && m.grade) return `（${escapeHtml(m.period)}期）${escapeHtml(m.grade)}`;
  if (m.period) return `（${escapeHtml(m.period)}期）`;
  if (m.grade) return `（${escapeHtml(m.grade)}）`;
  return "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
