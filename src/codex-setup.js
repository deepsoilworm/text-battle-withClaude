#!/usr/bin/env node

/**
 * Codex용 text-battle 세팅
 * - AGENTS.md 생성 (Codex가 읽는 지시 파일)
 * - .env 파일 생성 (환경변수)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";

const homeDir = process.env.HOME || process.env.USERPROFILE;
const configPath = join(homeDir, ".text-battle.json");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const AGENTS_MD = `# Text Battle Game — AI Instructions

You have access to the text-battle CLI tool for managing characters and battles.
Run commands with: \`npx --package text-battle text-battle-cli <command>\`

## Available Commands

\`\`\`bash
# 캐릭터 목록
npx --package text-battle text-battle-cli list

# 캐릭터 상세
npx --package text-battle text-battle-cli get "캐릭터이름"

# 캐릭터 생성 (이름 20자, 설명 300자 이내)
npx --package text-battle text-battle-cli create "이름" "능력 설명..."

# 캐릭터 삭제
npx --package text-battle text-battle-cli delete "이름"

# Elo 기반 자동 매칭
npx --package text-battle text-battle-cli match "내캐릭터"

# 배틀 결과 저장
npx --package text-battle text-battle-cli save "캐릭터A" "캐릭터B" "승자이름" 점수A 점수B "배틀 요약"

# 랭킹 조회
npx --package text-battle text-battle-cli leaderboard --top 10
\`\`\`

## Battle Rules (심판 기준)

When judging battles, follow these rules strictly:

1. **과장 페널티**: "무적", "전지전능" 같은 과장 표현은 약점으로 작용. 구체성이 곧 힘.
2. **창의성 보너스**: 독창적이고 구체적인 능력이 유리.
3. **상성 반영**: 물>불, 속도>힘, 지혜>완력, 원거리>근접(접근 시 역전).
4. **약점 활용**: 설명에 암시된 약점을 상대가 이용 가능.
5. **불확실성**: 강한 캐릭터도 약 30% 확률로 질 수 있음.
6. **길이 무관**: 짧은 설명이라도 핵심이 명확하면 충분히 강함.

## Battle Flow

1. \`text-battle-cli match "내캐릭터"\` 로 상대 찾기
2. 두 캐릭터 정보로 3-5라운드 배틀 판정
3. 배틀 출력 형식:

\`\`\`
## ⚔️ {A} vs {B}
| | {A} | {B} |
|---|:---:|:---:|
| Elo | ... | ... |
| 전적 | ... | ... |

### 라운드 1
(전투 묘사 2-4문장)
...

### 🏆 결과
승자: {승자}
> MVP: "{가장 드라마틱한 순간}"
\`\`\`

4. \`text-battle-cli save ...\` 로 결과 저장
`;

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("⚔️  텍스트 배틀 게임 — Codex Setup");
  console.log("─".repeat(40));
  console.log("");

  const owner = await ask(rl, "🎮 플레이어 이름: ");
  const secret = await ask(rl, "🔒 비밀번호: ");

  if (!owner.trim() || !secret.trim()) {
    console.error("❌ 이름과 비밀번호를 모두 입력해주세요.");
    rl.close();
    process.exit(1);
  }

  const cwd = process.cwd();

  // 1. AGENTS.md 생성
  const agentsPath = join(cwd, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const existing = readFileSync(agentsPath, "utf-8");
    if (existing.includes("Text Battle Game")) {
      // 이미 있으면 교체
      const cleaned = existing.replace(/# Text Battle Game[\s\S]*/, "").trim();
      writeFileSync(agentsPath, cleaned ? `${cleaned}\n\n${AGENTS_MD}` : AGENTS_MD, "utf-8");
    } else {
      writeFileSync(agentsPath, `${existing.trim()}\n\n${AGENTS_MD}`, "utf-8");
    }
  } else {
    writeFileSync(agentsPath, AGENTS_MD, "utf-8");
  }
  console.log(`✅ AGENTS.md 생성 완료 → ${agentsPath}`);

  // 2. ~/.text-battle.json 설정 파일 생성
  const cfg = { owner: owner.trim(), secret: secret.trim() };
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
  console.log(`✅ 설정 파일 생성 완료 → ${configPath}`);

  console.log("");
  console.log("─".repeat(40));
  console.log("🎉 Codex 설정 완료!");
  console.log("");
  console.log("Codex에서 이렇게 말하세요:");
  console.log('   "배틀 시작!"');
  console.log('   "캐릭터 만들어줘"');
  console.log('   "랭킹 보여줘"');
  console.log("");
  console.log("Codex가 자동으로 text-battle-cli 명령어를 사용합니다.");
  console.log("");

  rl.close();
}

setup();
