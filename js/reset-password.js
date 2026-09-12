import { supabase } from "./supabase-client.js";

const form = document.getElementById("reset-form");
const errorText = document.getElementById("error-text");
const btn = document.getElementById("reset-btn");

// メール内のリンクを開くと、Supabaseが自動的にURLから
// パスワード再設定用の一時セッションを認識する

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.textContent = "";

  const password = document.getElementById("password").value;
  const password2 = document.getElementById("password2").value;

  if (password !== password2) {
    errorText.textContent = "パスワードが一致しません。";
    return;
  }

  btn.disabled = true;
  btn.textContent = "変更中...";

  const { error } = await supabase.auth.updateUser({ password });

  btn.disabled = false;
  btn.textContent = "パスワードを変更する";

  if (error) {
    errorText.textContent =
      "パスワードの変更に失敗しました。メール内のリンクの有効期限が切れている場合は、もう一度パスワード再設定をお試しください。";
    return;
  }

  alert("パスワードを変更しました。新しいパスワードでログインしてください。");
  window.location.href = "login.html";
});
