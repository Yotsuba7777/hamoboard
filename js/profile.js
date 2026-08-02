import { supabase } from "./supabase-client.js";
import { requireAuth, renderNav } from "./nav.js";

const user = await requireAuth();
if (user) {
  renderNav("profile");
  loadProfile();
}

const form = document.getElementById("profile-form");
const saveBtn = document.getElementById("profile-save");
const msg = document.getElementById("profile-msg");

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return;

  document.getElementById("p-name").value = data.display_name || "";
  document.getElementById("p-part").value = data.part || "未設定";
  document.getElementById("p-grade").value = data.grade || "";
  document.getElementById("p-bio").value = data.bio || "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.color = "";
  msg.textContent = "";
  saveBtn.disabled = true;
  saveBtn.textContent = "保存中...";

  const payload = {
    display_name: document.getElementById("p-name").value.trim(),
    part: document.getElementById("p-part").value,
    grade: document.getElementById("p-grade").value.trim(),
    bio: document.getElementById("p-bio").value.trim(),
  };

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
