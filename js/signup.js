import { supabase } from "./supabase-client.js";

const form = document.getElementById("signup-form");
const errorText = document.getElementById("error-text");
const btn = document.getElementById("signup-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.textContent = "";
  btn.disabled = true;
  btn.textContent = "確認中...";

  const invite = document.getElementById("invite").value.trim();
  const display_name = document.getElementById("display_name").value.trim();
  const grade = document.getElementById("grade").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // 1. 招待コードが正しいかを先に確認する
  const { data: isValid, error: rpcError } = await supabase.rpc("check_invite_code", {
    input_code: invite,
  });

  if (rpcError || !isValid) {
    errorText.textContent = "招待コードが正しくありません。サークル内で確認してください。";
    btn.disabled = false;
    btn.textContent = "登録する";
    return;
  }

  // 2. 招待コードが正しければアカウント作成
  //    display_name / grade は raw_user_meta_data に載せて送る
  //    → DB側のトリガーが自動的にprofilesへ反映してくれる
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name, grade, part: "未設定" },
    },
  });

  if (signUpError) {
    errorText.textContent =
      signUpError.message.includes("already registered")
        ? "このメールアドレスは既に登録されています。"
        : "登録に失敗しました。時間をおいて再度お試しください。";
    btn.disabled = false;
    btn.textContent = "登録する";
    return;
  }

  window.location.href = "index.html";
});
