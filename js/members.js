import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const listEl = document.getElementById("member-list");
const nameFilter = document.getElementById("f-name");
const gradeFilter = document.getElementById("f-grade");
const partFilter = document.getElementById("f-part");

let allMembers = [];

const user = await requireAuth();
if (user) {
  renderNav("members");
  loadMembers();
}

nameFilter.addEventListener("input", renderFilteredList);
gradeFilter.addEventListener("change", renderFilteredList);
partFilter.addEventListener("change", renderFilteredList);

async function loadMembers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    listEl.innerHTML = `<p class="empty-state">読み込みに失敗しました。時間をおいて再度お試しください。</p>`;
    return;
  }

  allMembers = data || [];

  if (allMembers.length === 0) {
    listEl.innerHTML = `<p class="empty-state">まだメンバーが登録されていません。</p>`;
    return;
  }

  populateGradeOptions(allMembers);
  renderFilteredList();
}

function populateGradeOptions(members) {
  const grades = Array.from(new Set(members.map((m) => m.grade).filter(Boolean))).sort();
  gradeFilter.innerHTML =
    `<option value="">学年:すべて</option>` +
    grades.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

function renderFilteredList() {
  const nameQuery = nameFilter.value.trim().toLowerCase();
  const gradeQuery = gradeFilter.value;
  const partQuery = partFilter.value;

  const filtered = allMembers.filter((m) => {
    if (nameQuery && !(m.display_name || "").toLowerCase().includes(nameQuery)) return false;
    if (gradeQuery && m.grade !== gradeQuery) return false;
    if (partQuery && !(m.parts || []).includes(partQuery)) return false;
    return true;
  });

  listEl.innerHTML =
    filtered.length > 0
      ? filtered.map(renderMemberCard).join("")
      : `<p class="empty-state">条件に一致するメンバーがいません。</p>`;
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
          ${m.attendance_number ? `<div class="member-artist">出席番号：${escapeHtml(m.attendance_number)}</div>` : ""}
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
