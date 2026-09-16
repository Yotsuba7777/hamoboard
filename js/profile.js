import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const form = document.getElementById("profile-form");
const saveBtn = document.getElementById("profile-save");
const msg = document.getElementById("profile-msg");

const user = await requireAuth();
if (user) {
  renderNav("profile");
  loadProfile();
}

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return;

  document.getElementById("p-name").value = data.display_name || "";
  document.getElementById("p-grade").value = data.grade || "";
  document.getElementById("p-period").value = data.period || "";
  document.getElementById("p-artist").value = data.favorite_artist || "";
  document.getElementById("p-bio").value = data.bio || "";
  document.getElementById("p-motivation").value = data.motivation || "";

  const selectedParts = data.parts || [];
  document
    .querySelectorAll('#p-parts input[type="checkbox"]')
    .forEach((c) => (c.checked = selectedParts.includes(c.value)));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.color = "";
  msg.textContent = "";

  const parts = Array.from(
    document.querySelectorAll('#p-parts input[type="checkbox"]:checked')
  ).map((c) => c.value);

  const payload = {
    display_name: document.getElementById("p-name").value.trim(),
    parts,
    motivation: document.getElementById("p-motivation").value || null,
    grade: document.getElementById("p-grade").value.trim(),
    period: document.getElementById("p-period").value.trim(),
    favorite_artist: document.getElementById("p-artist").value.trim(),
    bio: document.getElementById("p-bio").value.trim(),
  };

  if (!payload.display_name || parts.length === 0 || !payload.motivation || !payload.grade) {
    msg.style.color = "#c0574a";
    msg.textContent = "名前・パート・参加意欲・学年は必須です。";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "保存中...";

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

  saveBtn.disabled = false;
  saveBtn.textContent = "保存する";

  if (error) {
    msg.style.color = "#c0574a";
    msg.textContent = "保存に失敗しました。時間をおいて再度お試しください。";
    return;
  }

  msg.style.color = "#3e8f84";
  msg.textContent = "保存しました。";
});

const deleteBtn = document.getElementById("delete-account-btn");
const deleteMsg = document.getElementById("delete-account-msg");

deleteBtn.addEventListener("click", async () => {
  const step1 = confirm(
    "本当に退会しますか？\n投稿・プロフィールなど、すべてのデータが完全に削除され、元に戻せません。"
  );
  if (!step1) return;

  const step2 = confirm("最終確認です。本当によろしいですか？");
  if (!step2) return;

  deleteBtn.disabled = true;
  deleteBtn.textContent = "処理中...";

  const { error } = await supabase.rpc("delete_own_account");

  if (error) {
    deleteBtn.disabled = false;
    deleteBtn.textContent = "退会する(アカウントを削除)";
    deleteMsg.textContent = "削除に失敗しました。時間をおいて再度お試しください。";
    return;
  }

  await supabase.auth.signOut();
  alert("退会が完了しました。ご利用ありがとうございました。");
  window.location.href = "login.html";
});
