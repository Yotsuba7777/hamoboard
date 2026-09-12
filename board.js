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

  // この一覧分のバンドに対する「パート別」リアクションをまとめて取得
  const bandIds = data.map((b) => b.id);
  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("band_id, user_id, part")
    .in("band_id", bandIds);

  // reactionMap[bandId][part] = { count, reactedByMe }
  const reactionMap = {};
  (reactionRows || []).forEach((r) => {
    if (!reactionMap[r.band_id]) reactionMap[r.band_id] = {};
    if (!reactionMap[r.band_id][r.part]) {
      reactionMap[r.band_id][r.part] = { count: 0, reactedByMe: false };
    }
    reactionMap[r.band_id][r.part].count += 1;
    if (r.user_id === user.id) reactionMap[r.band_id][r.part].reactedByMe = true;
  });

  listEl.innerHTML = data
    .map((band) => renderBandCard(band, user.id, reactionMap[band.id] ?? {}))
    .join("");

  // 締切・削除・パート別リアクションボタンのイベントを後付け
  listEl.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeBand(btn.dataset.close))
  );
  listEl.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteBand(btn.dataset.delete))
  );
  listEl.querySelectorAll("[data-react]").forEach((btn) =>
    btn.addEventListener("click", () =>
      toggleReaction(btn.dataset.react, btn.dataset.part, btn.dataset.reacted === "true")
    )
  );
}

function renderBandCard(band, myId, partReactions) {
  const isOpen = band.status === "募集中";
  const leaderName = band.profiles?.display_name ?? "不明";
  const parts = band.needed_parts || [];
  const partButtons = parts
    .map((p) => {
      const r = partReactions[p] ?? { count: 0, reactedByMe: false };
      return `
        <button class="part-reaction ${r.reactedByMe ? "active" : ""}" data-react="${band.id}" data-part="${escapeHtml(p)}" data-reacted="${r.reactedByMe}">
          <span class="part-reaction-name">${escapeHtml(p)}</span>
          <span class="part-reaction-heart">${r.reactedByMe ? "♥" : "♡"}</span>
          <span class="part-reaction-count">${r.count}</span>
        </button>
      `;
    })
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
      ${partButtons ? `<div class="part-reaction-row">${partButtons}</div>` : ""}
      <div class="hint">気になるパートの♡を押すと、リーダーに伝わります</div>
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

async function toggleReaction(bandId, part, currentlyReacted) {
  if (currentlyReacted) {
    await supabase
      .from("reactions")
      .delete()
      .eq("band_id", bandId)
      .eq("user_id", user.id)
      .eq("part", part);
  } else {
    await supabase.from("reactions").insert({ band_id: bandId, user_id: user.id, part });
  }
  loadBands();
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
