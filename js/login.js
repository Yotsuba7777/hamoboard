import { supabase } from "./supabase-client.js";

// 既にログイン済みなら掲示板へ
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.href = "index.html";

const form = document.getElementById("login-form");
const errorText = document.getElementById("error-text");
const btn = document.getElementById("login-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.textContent = "";
  btn.disabled = true;
  btn.textContent = "ログイン中...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorText.textContent = "メールアドレスまたはパスワードが正しくありません。";
    btn.disabled = false;
    btn.textContent = "ログイン";
    return;
  }

  window.location.href = "index.html";
});
