import { supabase } from "./supabase-client.js";

const form = document.getElementById("forgot-form");
const errorText = document.getElementById("error-text");
const successText = document.getElementById("success-text");
const btn = document.getElementById("forgot-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.textContent = "";
  successText.style.display = "none";
  btn.disabled = true;
  btn.textContent = "送信中...";

  const email = document.getElementById("email").value.trim();

  // 現在のページと同じ場所にある reset-password.html にリダイレクトさせる
  const redirectTo = new URL("reset-password.html", window.location.href).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  btn.disabled = false;
  btn.textContent = "再設定メールを送る";

  if (error) {
    errorText.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
    return;
  }

  // セキュリティ上、登録の有無に関わらず同じ成功メッセージを出す
  form.reset();
  successText.style.display = "block";
});
