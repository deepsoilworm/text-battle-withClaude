#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_SOURCE = join(__dirname, "..", "CLAUDE.md");

// 유저 홈 디렉토리의 .claude 경로
const homeDir = process.env.HOME || process.env.USERPROFILE;
const claudeDir = join(homeDir, ".claude");
const targetPath = join(claudeDir, "CLAUDE.md");

function setup() {
  console.log("");
  console.log("⚔️  텍스트 배틀 게임 — Setup");
  console.log("─".repeat(40));
  console.log("");

  // CLAUDE.md 소스 확인
  if (!existsSync(CLAUDE_MD_SOURCE)) {
    console.error("❌ CLAUDE.md 파일을 찾을 수 없습니다.");
    process.exit(1);
  }

  // .claude 디렉토리 생성
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
    console.log(`📁 ${claudeDir} 디렉토리 생성`);
  }

  // 기존 CLAUDE.md 확인
  if (existsSync(targetPath)) {
    const existing = readFileSync(targetPath, "utf-8");
    if (existing.includes("텍스트 배틀 게임")) {
      console.log("✅ 이미 설치되어 있습니다. 업데이트합니다.");
      // 기존 텍스트 배틀 섹션 제거 후 새로 추가
      const cleaned = existing.replace(
        /# 텍스트 배틀 게임[\s\S]*?(?=\n# [^텍]|\Z)/,
        ""
      ).trim();
      const battleMd = readFileSync(CLAUDE_MD_SOURCE, "utf-8");
      const merged = cleaned ? `${cleaned}\n\n${battleMd}` : battleMd;
      writeFileSync(targetPath, merged, "utf-8");
    } else {
      // 기존 내용에 추가
      const battleMd = readFileSync(CLAUDE_MD_SOURCE, "utf-8");
      const merged = `${existing.trim()}\n\n${battleMd}`;
      writeFileSync(targetPath, merged, "utf-8");
      console.log("✅ 기존 CLAUDE.md에 배틀 설정 추가 완료");
    }
  } else {
    // 새로 복사
    const battleMd = readFileSync(CLAUDE_MD_SOURCE, "utf-8");
    writeFileSync(targetPath, battleMd, "utf-8");
    console.log("✅ CLAUDE.md 설치 완료");
  }

  console.log(`   → ${targetPath}`);
  console.log("");
  console.log("─".repeat(40));
  console.log("🎮 사용법:");
  console.log('   Claude Code에서 "배틀 시작" 이라고 말하세요!');
  console.log("");
}

setup();
