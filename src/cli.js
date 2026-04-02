#!/usr/bin/env node

/**
 * text-battle CLI — MCP 없이 Supabase 직접 호출
 * Codex, ChatGPT, 또는 어떤 AI든 bash로 사용 가능
 *
 * Usage:
 *   text-battle-cli list [--filter all|npcs|players]
 *   text-battle-cli get <name>
 *   text-battle-cli create <name> <description>
 *   text-battle-cli delete <name>
 *   text-battle-cli match <my_character>
 *   text-battle-cli save <charA> <charB> <winner> <scoreA> <scoreB> <summary>
 *   text-battle-cli leaderboard [--top 10] [--highlight name]
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// --- Config: ~/.text-battle.json > 환경변수 > 기본값 ---
let config = {};
const configPath = join(process.env.HOME || process.env.USERPROFILE, ".text-battle.json");
if (existsSync(configPath)) {
  try { config = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
}

const supabaseUrl = process.env.TEXT_BATTLE_SUPABASE_URL || config.supabaseUrl || "https://rdgkcwvcqweoflgiqoun.supabase.co";
const supabaseKey = process.env.TEXT_BATTLE_SUPABASE_KEY || config.supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZ2tjd3ZjcXdlb2ZsZ2lxb3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDcxOTEsImV4cCI6MjA5MDYyMzE5MX0.qX6Osx758YmcRlHy54iHSd6aFCg8E7r4NL88XueaJmg";
const OWNER_ID = process.env.TEXT_BATTLE_OWNER || config.owner || "anonymous";
const OWNER_SECRET = process.env.TEXT_BATTLE_SECRET || config.secret || "";

const supabase = createClient(supabaseUrl, supabaseKey);

function hashSecret(owner, secret) {
  return createHash("sha256").update(`${owner}:${secret}`).digest("hex");
}

async function verifyOwner() {
  if (!OWNER_SECRET) {
    return { ok: false, msg: "TEXT_BATTLE_SECRET 환경변수를 설정해주세요." };
  }
  const hash = hashSecret(OWNER_ID, OWNER_SECRET);
  const { data: player } = await supabase
    .from("players").select("*").eq("owner", OWNER_ID).single();

  if (!player) {
    const { error } = await supabase.from("players").insert({ owner: OWNER_ID, owner_hash: hash });
    if (error) return { ok: false, msg: `등록 실패: ${error.message}` };
    return { ok: true, hash };
  }
  if (player.owner_hash !== hash) {
    await supabase.from("players").update({ owner_hash: hash }).eq("owner", OWNER_ID);
    return { ok: true, msg: "비밀번호 변경됨", hash };
  }
  return { ok: true, hash };
}

function calculateElo(winnerElo, loserElo, k = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + k * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + k * (0 - expectedLoser)),
  };
}

// --- Commands ---

async function cmdList(args) {
  const filterIdx = args.indexOf("--filter");
  const filter = filterIdx >= 0 ? args[filterIdx + 1] : "all";

  let query = supabase
    .from("characters")
    .select("name, description, owner, is_npc, wins, losses, draws, elo")
    .order("elo", { ascending: false });

  if (filter === "npcs") query = query.eq("is_npc", true);
  if (filter === "players") query = query.eq("is_npc", false);

  const { data, error } = await query;
  if (error) return console.error(`ERROR: ${error.message}`);
  if (!data || data.length === 0) return console.log("등록된 캐릭터가 없습니다.");

  console.log(`캐릭터 목록 (${data.length}명)`);
  console.log("─".repeat(60));
  data.forEach((c, i) => {
    const tag = c.is_npc ? " [NPC]" : "";
    console.log(`${i + 1}. ${c.name}${tag} | Elo: ${c.elo} | ${c.wins}W ${c.losses}L ${c.draws}D | owner: ${c.owner}`);
  });
}

async function cmdGet(args) {
  const name = args.join(" ");
  if (!name) return console.error("ERROR: 이름을 입력하세요. Usage: text-battle-cli get <name>");

  const { data, error } = await supabase
    .from("characters").select("*").eq("name", name).single();

  if (error || !data) return console.error(`"${name}" 캐릭터를 찾을 수 없습니다.`);

  const total = data.wins + data.losses + data.draws;
  const winRate = (data.wins + data.losses) > 0
    ? Math.round((data.wins / (data.wins + data.losses)) * 100) : 0;

  console.log(`이름: ${data.name} ${data.is_npc ? "(NPC)" : ""}`);
  console.log(`설명: ${data.description}`);
  console.log(`Elo: ${data.elo}`);
  console.log(`전적: ${data.wins}W ${data.losses}L ${data.draws}D (${total}전, 승률 ${winRate}%)`);
  console.log(`소유자: ${data.owner}`);
  console.log(`글자수: ${data.description.length}/300`);
}

async function cmdCreate(args) {
  if (args.length < 2) return console.error("ERROR: Usage: text-battle-cli create <name> <description>");

  const name = args[0];
  const description = args.slice(1).join(" ");

  if (name.length > 20) return console.error("ERROR: 이름은 20자 이내.");
  if (description.length > 300) return console.error("ERROR: 설명은 300자 이내.");

  const auth = await verifyOwner();
  if (!auth.ok) return console.error(`ERROR: ${auth.msg}`);

  const { data: existing } = await supabase
    .from("characters").select("name").eq("name", name).single();
  if (existing) return console.error(`ERROR: "${name}" 이름이 이미 존재합니다.`);

  const { data, error } = await supabase
    .from("characters")
    .insert({ name, description, owner: OWNER_ID, owner_hash: auth.hash, is_npc: false })
    .select().single();

  if (error) return console.error(`ERROR: ${error.message}`);

  console.log(`캐릭터 생성 완료!`);
  console.log(`이름: ${data.name}`);
  console.log(`설명: ${data.description}`);
  console.log(`Elo: ${data.elo}`);
  console.log(`글자수: ${description.length}/300`);
}

async function cmdDelete(args) {
  const name = args.join(" ");
  if (!name) return console.error("ERROR: Usage: text-battle-cli delete <name>");

  const auth = await verifyOwner();
  if (!auth.ok) return console.error(`ERROR: ${auth.msg}`);

  const { data: char } = await supabase
    .from("characters").select("*").eq("name", name).single();
  if (!char) return console.error(`ERROR: "${name}" 캐릭터를 찾을 수 없습니다.`);
  if (char.is_npc) return console.error("ERROR: NPC는 삭제할 수 없습니다.");
  if (char.owner_hash !== auth.hash) return console.error("ERROR: 본인 캐릭터만 삭제 가능합니다.");

  const { error } = await supabase.from("characters").delete().eq("name", name);
  if (error) return console.error(`ERROR: ${error.message}`);

  console.log(`"${name}" 삭제 완료.`);
}

async function cmdMatch(args) {
  const myName = args.join(" ");
  if (!myName) return console.error("ERROR: Usage: text-battle-cli match <my_character>");

  const { data: mine } = await supabase
    .from("characters").select("*").eq("name", myName).single();
  if (!mine) return console.error(`ERROR: "${myName}" 캐릭터를 찾을 수 없습니다.`);

  let { data: candidates } = await supabase
    .from("characters").select("*")
    .neq("name", myName)
    .gte("elo", mine.elo - 200).lte("elo", mine.elo + 200)
    .order("elo", { ascending: false });

  let opponent;
  if (candidates && candidates.length > 0) {
    const pool = candidates.slice(0, Math.min(3, candidates.length));
    opponent = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const { data: all } = await supabase
      .from("characters").select("*").neq("name", myName).limit(1);
    if (!all || all.length === 0) return console.error("ERROR: 매칭할 상대가 없습니다.");
    opponent = all[0];
  }

  console.log(`매칭 완료!`);
  console.log(`─`.repeat(40));
  console.log(`[A] ${mine.name} (Elo: ${mine.elo}, ${mine.wins}W ${mine.losses}L)`);
  console.log(`    ${mine.description}`);
  console.log(`[B] ${opponent.name}${opponent.is_npc ? " [NPC]" : ""} (Elo: ${opponent.elo}, ${opponent.wins}W ${opponent.losses}L)`);
  console.log(`    ${opponent.description}`);
  console.log(`Elo 차이: ${Math.abs(mine.elo - opponent.elo)}`);
}

async function cmdSave(args) {
  if (args.length < 6) {
    return console.error("ERROR: Usage: text-battle-cli save <charA> <charB> <winner|draw> <scoreA> <scoreB> <summary...>");
  }

  const [character_a, character_b, winner, scoreAStr, scoreBStr, ...summaryParts] = args;
  const score_a = parseInt(scoreAStr, 10);
  const score_b = parseInt(scoreBStr, 10);
  const summary = summaryParts.join(" ");

  if (isNaN(score_a) || isNaN(score_b)) return console.error("ERROR: 점수는 숫자여야 합니다.");

  const { data: charA } = await supabase.from("characters").select("*").eq("name", character_a).single();
  const { data: charB } = await supabase.from("characters").select("*").eq("name", character_b).single();
  if (!charA || !charB) return console.error("ERROR: 캐릭터를 찾을 수 없습니다.");

  const oldEloA = charA.elo;
  const oldEloB = charB.elo;

  const { error: battleError } = await supabase.from("battles").insert({
    character_a, character_b, winner,
    score_a, score_b,
    narrative: [summary], mvp_moment: "", reasoning: "",
  });
  if (battleError) return console.error(`ERROR: ${battleError.message}`);

  let newEloA = oldEloA;
  let newEloB = oldEloB;

  try {
    if (winner === "draw") {
      const [resA, resB] = await Promise.all([
        supabase.from("characters").update({ draws: charA.draws + 1 }).eq("name", character_a),
        supabase.from("characters").update({ draws: charB.draws + 1 }).eq("name", character_b),
      ]);
      if (resA.error) throw resA.error;
      if (resB.error) throw resB.error;
    } else {
      const isAWinner = winner === character_a;
      const winnerChar = isAWinner ? charA : charB;
      const loserChar = isAWinner ? charB : charA;
      const { newWinnerElo, newLoserElo } = calculateElo(winnerChar.elo, loserChar.elo);
      newEloA = isAWinner ? newWinnerElo : newLoserElo;
      newEloB = isAWinner ? newLoserElo : newWinnerElo;

      const [resW, resL] = await Promise.all([
        supabase.from("characters").update({ wins: winnerChar.wins + 1, elo: newWinnerElo }).eq("name", winnerChar.name),
        supabase.from("characters").update({ losses: loserChar.losses + 1, elo: newLoserElo }).eq("name", loserChar.name),
      ]);
      if (resW.error) throw resW.error;
      if (resL.error) throw resL.error;
    }
  } catch (err) {
    await supabase.from("battles").delete()
      .eq("character_a", character_a).eq("character_b", character_b)
      .order("created_at", { ascending: false }).limit(1);
    return console.error(`ERROR: 전적 업데이트 실패, 롤백됨: ${err.message}`);
  }

  const fmtChange = (v) => (v >= 0 ? `+${v}` : `${v}`);
  console.log(`배틀 결과 저장 완료!`);
  console.log(`승자: ${winner === "draw" ? "무승부" : winner}`);
  console.log(`${character_a}: ${score_a}점, Elo ${oldEloA} → ${newEloA} (${fmtChange(newEloA - oldEloA)})`);
  console.log(`${character_b}: ${score_b}점, Elo ${oldEloB} → ${newEloB} (${fmtChange(newEloB - oldEloB)})`);
}

async function cmdLeaderboard(args) {
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) : 10;
  const hlIdx = args.indexOf("--highlight");
  const highlight = hlIdx >= 0 ? args[hlIdx + 1] : null;

  const { data, error } = await supabase
    .from("characters")
    .select("name, owner, is_npc, wins, losses, draws, elo")
    .order("elo", { ascending: false })
    .limit(top);

  if (error) return console.error(`ERROR: ${error.message}`);
  if (!data || data.length === 0) return console.log("랭킹 데이터가 없습니다.");

  const medals = ["👑", "🥈", "🥉"];
  console.log("텍스트 배틀 랭킹");
  console.log("─".repeat(50));
  data.forEach((c, i) => {
    const rank = i < 3 ? medals[i] : `${i + 1}.`;
    const tag = c.is_npc ? " [NPC]" : "";
    const total = c.wins + c.losses;
    const winRate = total > 0 ? `${Math.round((c.wins / total) * 100)}%` : "-";
    const marker = highlight && c.name === highlight ? " ← YOU" : "";
    console.log(`${rank} ${c.name}${tag} | Elo: ${c.elo} | ${c.wins}W ${c.losses}L ${c.draws}D | 승률: ${winRate}${marker}`);
  });
}

// --- Main ---
const [command, ...args] = process.argv.slice(2);

const commands = {
  list: cmdList,
  get: cmdGet,
  create: cmdCreate,
  delete: cmdDelete,
  match: cmdMatch,
  save: cmdSave,
  leaderboard: cmdLeaderboard,
  lb: cmdLeaderboard,
};

if (!command || !commands[command]) {
  console.log(`text-battle CLI — 텍스트 배틀 게임

Usage: text-battle-cli <command> [args]

Commands:
  list [--filter all|npcs|players]         캐릭터 목록
  get <name>                               캐릭터 상세
  create <name> <description>              캐릭터 생성
  delete <name>                            캐릭터 삭제
  match <my_character>                     Elo 기반 매칭
  save <A> <B> <winner> <scoreA> <scoreB> <summary>  배틀 결과 저장
  leaderboard [--top N] [--highlight name] 랭킹 조회

Environment:
  TEXT_BATTLE_OWNER    플레이어 이름
  TEXT_BATTLE_SECRET   비밀번호
`);
  process.exit(command ? 1 : 0);
}

try {
  await commands[command](args);
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
