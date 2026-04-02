#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_SOURCE = join(__dirname, "..", "CLAUDE.md");

const homeDir = process.env.HOME || process.env.USERPROFILE;
const claudeDir = join(homeDir, ".claude");
const claudeMdPath = join(claudeDir, "CLAUDE.md");
const settingsPath = join(claudeDir, "settings.json");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("⚔️  텍스트 배틀 게임 — Setup");
  console.log("─".repeat(40));
  console.log("");

  // 1. 이름/비밀번호 입력
  const owner = await ask(rl, "🎮 플레이어 이름: ");
  const secret = await ask(rl, "🔒 비밀번호: ");

  if (!owner.trim() || !secret.trim()) {
    console.error("❌ 이름과 비밀번호를 모두 입력해주세요.");
    rl.close();
    process.exit(1);
  }

  console.log("");

  // 2. .claude 디렉토리 생성
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  // 3. settings.json에 MCP 서버 등록
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  settings.mcpServers["text-battle"] = {
    command: "npx",
    args: ["--package", "text-battle", "text-battle"],
    env: {
      TEXT_BATTLE_OWNER: owner.trim(),
      TEXT_BATTLE_SECRET: secret.trim(),
    },
  };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  console.log("✅ MCP 서버 등록 완료");
  console.log(`   → ${settingsPath}`);

  // 4. CLAUDE.md 배틀 연출 설치
  if (existsSync(CLAUDE_MD_SOURCE)) {
    const battleMd = readFileSync(CLAUDE_MD_SOURCE, "utf-8");

    if (existsSync(claudeMdPath)) {
      const existing = readFileSync(claudeMdPath, "utf-8");
      if (existing.includes("텍스트 배틀 게임")) {
        const cleaned = existing
          .replace(/# 텍스트 배틀 게임[\s\S]*?(?=\n# [^텍]|$)/, "")
          .trim();
        const merged = cleaned ? `${cleaned}\n\n${battleMd}` : battleMd;
        writeFileSync(claudeMdPath, merged, "utf-8");
      } else {
        writeFileSync(claudeMdPath, `${existing.trim()}\n\n${battleMd}`, "utf-8");
      }
    } else {
      writeFileSync(claudeMdPath, battleMd, "utf-8");
    }
    console.log("✅ 배틀 연출 설치 완료");
    console.log(`   → ${claudeMdPath}`);
  }

  console.log("");
  console.log("─".repeat(40));
  console.log("🎉 설치 완료!");
  console.log("");
  console.log("Claude Code를 열고 이렇게 말하세요:");
  console.log('   "배틀 시작!"');
  console.log('   "캐릭터 만들어줘"');
  console.log('   "랭킹 보여줘"');
  console.log("");

  rl.close();
}

setup();
