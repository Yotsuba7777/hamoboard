import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const user = await requireAuth();
if (user) {
  renderNav("board");
  loadBands();
}

const listEl = document.getElementById("band-list");
const filterOpen = document.getElementById("filter-open");
const modal = document.getElementById("band-modal");
const openBtn = document.getElementById("open-new-band");
const closeBtn = document.getElementById("close-modal");
const form = document.getElementById("band-form");
const submitBtn = document.getElementById("band-submit");
const errorText = document.getElementById("band-error");

filterOpen.addEventListener("change", loadBands);
openBtn.addEventListener("click", () => modal.classList.add("open"));
closeBtn.addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("open");
});

async function loadBands() {
  listEl.innerHTML = `<p class="loading">読み込み中...</p>`;

  let query = supabase
    .from("bands")
    .select("*, profiles(display_name)")
    .order("created_at", { ascending: false });

  if (filterOpen.checked) query = query.eq("status", "募集中");

  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<p class="empty-state">読み込みに失敗しました。時間をおいて再度お試しください。</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="empty-state">まだ投稿がありません。最初の募集を出してみましょう。</p>`;
    return;
  }

  listEl.innerHTML = data.map((band) => renderBandCard(band, user.id)).join("");

  // 締切・削除ボタンのイベントを後付け
  listEl.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeBand(btn.dataset.close))
  );
  listEl.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteBand(btn.dataset.delete))
  );
}

function renderBandCard(band, myId) {
  const isOpen = band.status === "募集中";
  const leaderName = band.profiles?.display_name ?? "不明";
  const tags = (band.needed_parts || [])
    .map((p) => `<span class="tag">${escapeHtml(p)}</span>`)
    .join("");
  const deadline = band.deadline
    ? `締切：${band.deadline}`
    : "締切：未定";
  const isMine = band.leader_id === myId;

  return `
    <div class="band-card">
      <span class="pill ${isOpen ? "pill-open" : "pill-closed"}">${isOpen ? "募集中" : "締切"}</span>
      <div class="band-title">${escapeHtml(band.title)}</div>
      ${band.genre ? `<div class="band-meta">${escapeHtml(band.genre)}</div>` : ""}
      ${band.description ? `<div class="band-desc">${escapeHtml(band.description)}</div>` : ""}
      ${tags ? `<div class="tag-row">${tags}</div>` : ""}
      <div class="band-meta">${deadline}　リーダー：${escapeHtml(leaderName)}${band.contact ? `　連絡先：${escapeHtml(band.contact)}` : ""}</div>
      ${
        isMine
          ? `<div class="band-actions">
              ${isOpen ? `<button class="btn btn-ghost btn-sm" data-close="${band.id}">締切にする</button>` : ""}
              <button class="btn btn-danger btn-sm" data-delete="${band.id}">削除</button>
            </div>`
          : ""
      }
    </div>
  `;
}

async function closeBand(id) {
  if (!confirm("この募集を締切にしますか？")) return;
  await supabase.from("bands").update({ status: "締切" }).eq("id", id);
  loadBands();
}

async function deleteBand(id) {
  if (!confirm("この投稿を削除しますか？元に戻せません。")) return;
  await supabase.from("bands").delete().eq("id", id);
  loadBands();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "投稿中...";

  const needed_parts = Array.from(
    document.querySelectorAll('#band-form input[type="checkbox"]:checked')
  ).map((c) => c.value);

  const payload = {
    title: document.getElementById("b-title").value.trim(),
    genre: document.getElementById("b-genre").value.trim(),
    description: document.getElementById("b-desc").value.trim(),
    needed_parts,
    deadline: document.getElementById("b-deadline").value || null,
    contact: document.getElementById("b-contact").value.trim(),
    leader_id: user.id,
  };

  const { error } = await supabase.from("bands").insert(payload);

  submitBtn.disabled = false;
  submitBtn.textContent = "投稿する";

  if (error) {
    errorText.textContent = "投稿に失敗しました。時間をおいて再度お試しください。";
    return;
  }

  form.reset();
  modal.classList.remove("open");
  loadBands();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
