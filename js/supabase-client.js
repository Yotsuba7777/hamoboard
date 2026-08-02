// ==========================================================
// ★ここを自分のSupabaseプロジェクトの値に書き換えてください
// Supabaseダッシュボード > Project Settings > API で確認できます
// どちらも「公開してよい値」なので、GitHubに置いても問題ありません。
// ==========================================================
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
