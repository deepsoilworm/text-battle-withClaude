#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Supabase 설정
const supabaseUrl = process.env.TEXT_BATTLE_SUPABASE_URL;
const supabaseKey = process.env.TEXT_BATTLE_SUPABASE_KEY;
const OWNER_ID = process.env.TEXT_BATTLE_OWNER || "anonymous";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "환경변수 TEXT_BATTLE_SUPABASE_URL, TEXT_BATTLE_SUPABASE_KEY를 설정해주세요."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Elo 계산
function calculateElo(winnerElo, loserElo, k = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + k * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + k * (0 - expectedLoser)),
  };
}

// MCP 서버 생성
const server = new McpServer({
  name: "text-battle",
  version: "1.0.0",
});

// 도구 1: 캐릭터 생성
server.tool(
  "create_character",
  "새 캐릭터를 생성합니다. 설명은 300자 이내.",
  {
    name: z.string().min(1).max(20).describe("캐릭터 이름 (1-20자)"),
    description: z
      .string()
      .min(1)
      .max(300)
      .describe("캐릭터 설명 (300자 이내)"),
  },
  async ({ name, description }) => {
    // 이름 중복 체크
    const { data: existing } = await supabase
      .from("characters")
      .select("name")
      .eq("name", name)
      .single();

    if (existing) {
      return {
        content: [
          {
            type: "text",
            text: `이미 "${name}" 이름의 캐릭터가 존재합니다.`,
          },
        ],
      };
    }

    const { data, error } = await supabase
      .from("characters")
      .insert({ name, description, owner: OWNER_ID, is_npc: false })
      .select()
      .single();

    if (error) {
      return {
        content: [{ type: "text", text: `생성 실패: ${error.message}` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `## ✅ 캐릭터 생성 완료!`,
            ``,
            `| 항목 | 값 |`,
            `|------|----|`,
            `| **이름** | ${data.name} |`,
            `| **설명** | ${data.description} |`,
            `| **글자수** | ${description.length}/300 |`,
            `| **Elo** | ${data.elo} |`,
          ].join("\n"),
        },
      ],
    };
  }
);

// 도구 2: 캐릭터 목록
server.tool(
  "list_characters",
  "등록된 캐릭터 목록을 조회합니다.",
  {
    filter: z
      .enum(["all", "npcs", "players"])
      .default("all")
      .describe("필터: all(전체), npcs(NPC만), players(플레이어만)"),
  },
  async ({ filter }) => {
    let query = supabase
      .from("characters")
      .select("name, description, owner, is_npc, wins, losses, draws, elo")
      .order("elo", { ascending: false });

    if (filter === "npcs") query = query.eq("is_npc", true);
    if (filter === "players") query = query.eq("is_npc", false);

    const { data, error } = await query;

    if (error) {
      return {
        content: [{ type: "text", text: `조회 실패: ${error.message}` }],
      };
    }

    if (!data || data.length === 0) {
      return {
        content: [{ type: "text", text: "등록된 캐릭터가 없습니다." }],
      };
    }

    const header = `# 캐릭터 목록 (${data.length}명)\n`;
    const tableHeader = `| # | 이름 | Elo | 전적 | 소유자 |\n|---|------|-----|------|--------|`;
    const rows = data
      .map((c, i) => {
        const tag = c.is_npc ? " [NPC]" : "";
        const record = `${c.wins}W ${c.losses}L`;
        return `| ${i + 1} | ${c.name}${tag} | ${c.elo} | ${record} | ${c.owner} |`;
      })
      .join("\n");

    return {
      content: [
        { type: "text", text: `${header}\n${tableHeader}\n${rows}` },
      ],
    };
  }
);

// 도구 3: 캐릭터 상세 조회
server.tool(
  "get_character",
  "특정 캐릭터의 상세 정보를 조회합니다.",
  {
    name: z.string().describe("캐릭터 이름"),
  },
  async ({ name }) => {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("name", name)
      .single();

    if (error || !data) {
      return {
        content: [
          { type: "text", text: `"${name}" 캐릭터를 찾을 수 없습니다.` },
        ],
      };
    }

    const winRate = (data.wins + data.losses) > 0
      ? Math.round((data.wins / (data.wins + data.losses)) * 100)
      : 0;
    const totalGames = data.wins + data.losses + data.draws;

    const info = [
      `## ${data.name} ${data.is_npc ? "(NPC)" : ""}`,
      ``,
      `> ${data.description}`,
      ``,
      `| 항목 | 값 |`,
      `|------|----|`,
      `| **Elo** | ${data.elo} |`,
      `| **전적** | ${data.wins}W ${data.losses}L ${data.draws}D (${totalGames}전) |`,
      `| **승률** | ${winRate}% |`,
      `| **소유자** | ${data.owner} |`,
      `| **글자수** | ${data.description.length}/300 |`,
    ].join("\n");

    return { content: [{ type: "text", text: info }] };
  }
);

// 도구 4: 배틀 결과 저장
server.tool(
  "save_battle",
  "배틀 결과를 저장하고 전적/Elo를 업데이트합니다. 호출 시 파라미터가 짧게 보이도록 summary에 내러티브를 합쳐서 전달하세요.",
  {
    character_a: z.string().describe("캐릭터 A 이름"),
    character_b: z.string().describe("캐릭터 B 이름"),
    winner: z.string().describe("승자 이름 (무승부면 'draw')"),
    score_a: z.number().min(0).max(100).describe("캐릭터 A 점수 (0-100)"),
    score_b: z.number().min(0).max(100).describe("캐릭터 B 점수 (0-100)"),
    summary: z.string().describe("배틀 요약 (내러티브 + MVP + 승패 이유를 한 문자열로)"),
  },
  async ({
    character_a,
    character_b,
    winner,
    score_a,
    score_b,
    summary,
  }) => {
    // 두 캐릭터 조회
    const { data: charA } = await supabase
      .from("characters")
      .select("*")
      .eq("name", character_a)
      .single();
    const { data: charB } = await supabase
      .from("characters")
      .select("*")
      .eq("name", character_b)
      .single();

    if (!charA || !charB) {
      return {
        content: [{ type: "text", text: "캐릭터를 찾을 수 없습니다." }],
      };
    }

    const oldEloA = charA.elo;
    const oldEloB = charB.elo;

    // 배틀 기록 저장
    const { error: battleError } = await supabase.from("battles").insert({
      character_a,
      character_b,
      winner,
      score_a,
      score_b,
      narrative: [summary],
      mvp_moment: "",
      reasoning: "",
    });

    if (battleError) {
      return {
        content: [
          { type: "text", text: `배틀 저장 실패: ${battleError.message}` },
        ],
      };
    }

    // 전적 + Elo 업데이트 (두 업데이트를 동시에 실행, 하나라도 실패하면 롤백)
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

        const { newWinnerElo, newLoserElo } = calculateElo(
          winnerChar.elo,
          loserChar.elo
        );

        newEloA = isAWinner ? newWinnerElo : newLoserElo;
        newEloB = isAWinner ? newLoserElo : newWinnerElo;

        const [resWinner, resLoser] = await Promise.all([
          supabase.from("characters").update({ wins: winnerChar.wins + 1, elo: newWinnerElo }).eq("name", winnerChar.name),
          supabase.from("characters").update({ losses: loserChar.losses + 1, elo: newLoserElo }).eq("name", loserChar.name),
        ]);
        if (resWinner.error) throw resWinner.error;
        if (resLoser.error) throw resLoser.error;
      }
    } catch (updateError) {
      // 배틀 기록은 저장됐지만 전적 업데이트 실패 — 배틀 기록도 삭제
      await supabase.from("battles").delete()
        .eq("character_a", character_a)
        .eq("character_b", character_b)
        .order("created_at", { ascending: false })
        .limit(1);
      return {
        content: [{ type: "text", text: `⚠️ 전적 업데이트 실패로 배틀이 취소되었습니다: ${updateError.message}` }],
      };
    }

    // Elo 변동 계산
    const eloChangeA = newEloA - oldEloA;
    const eloChangeB = newEloB - oldEloB;
    const fmtChange = (v) => (v >= 0 ? `+${v}` : `${v}`);

    // 현재 전체 순위 조회
    const { data: ranking } = await supabase
      .from("characters")
      .select("name, elo")
      .order("elo", { ascending: false });

    const rankA = ranking ? ranking.findIndex((c) => c.name === character_a) + 1 : "?";
    const rankB = ranking ? ranking.findIndex((c) => c.name === character_b) + 1 : "?";
    const totalPlayers = ranking ? ranking.length : "?";

    const winnerEmoji = winner === "draw" ? "🤝" : "🏆";
    const result = [
      `## ${winnerEmoji} 배틀 결과 저장 완료`,
      ``,
      `**승자: ${winner === "draw" ? "무승부" : winner}**`,
      ``,
      `| | ${character_a} | ${character_b} |`,
      `|---|:---:|:---:|`,
      `| **점수** | ${score_a} | ${score_b} |`,
      `| **Elo** | ${oldEloA} → **${newEloA}** (${fmtChange(eloChangeA)}) | ${oldEloB} → **${newEloB}** (${fmtChange(eloChangeB)}) |`,
      `| **순위** | ${rankA}/${totalPlayers} | ${rankB}/${totalPlayers} |`,
    ].join("\n");

    return { content: [{ type: "text", text: result }] };
  }
);

// 도구 5: 랭킹 조회
server.tool(
  "get_leaderboard",
  "Elo 랭킹을 조회합니다. highlight로 특정 캐릭터 위치를 강조할 수 있습니다.",
  {
    top: z.number().default(10).describe("상위 몇 명까지 표시 (기본 10)"),
    highlight: z.string().optional().describe("강조 표시할 캐릭터 이름 (내 캐릭터)"),
  },
  async ({ top, highlight }) => {
    const { data, error } = await supabase
      .from("characters")
      .select("name, owner, is_npc, wins, losses, draws, elo")
      .order("elo", { ascending: false })
      .limit(top);

    if (error) {
      return {
        content: [{ type: "text", text: `조회 실패: ${error.message}` }],
      };
    }

    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "랭킹 데이터가 없습니다." }] };
    }

    const medals = ["👑", "🥈", "🥉"];
    const header = `## 텍스트 배틀 랭킹\n`;
    const tableHeader = `| 순위 | 이름 | Elo | 전적 | 승률 |\n|:----:|------|:---:|------|:----:|`;
    const rows = data
      .map((c, i) => {
        const rank = i < 3 ? medals[i] : `${i + 1}`;
        const tag = c.is_npc ? " [NPC]" : "";
        const total = c.wins + c.losses;
        const winRate = total > 0 ? `${Math.round((c.wins / total) * 100)}%` : "-";
        const isMe = highlight && c.name === highlight;
        const arrow = isMe ? "→ " : "";
        const name = isMe ? `**⭐ ${c.name}**` : `**${c.name}**`;
        return `| ${arrow}${rank} | ${name}${tag} | ${c.elo} | ${c.wins}W ${c.losses}L ${c.draws}D | ${winRate} |`;
      })
      .join("\n");

    return {
      content: [
        { type: "text", text: `${header}\n${tableHeader}\n${rows}` },
      ],
    };
  }
);

// 도구 6: 랭크 매칭
server.tool(
  "find_match",
  "내 캐릭터와 Elo가 비슷한 상대를 자동으로 찾아 매칭합니다. 배틀할 준비가 된 두 캐릭터 정보를 반환합니다.",
  {
    my_character: z.string().describe("내 캐릭터 이름"),
  },
  async ({ my_character }) => {
    // 내 캐릭터 조회
    const { data: mine } = await supabase
      .from("characters")
      .select("*")
      .eq("name", my_character)
      .single();

    if (!mine) {
      return {
        content: [
          { type: "text", text: `"${my_character}" 캐릭터를 찾을 수 없습니다.` },
        ],
      };
    }

    // Elo 비슷한 상대 찾기 (본인 제외, Elo 차이 적은 순)
    const { data: candidates } = await supabase
      .from("characters")
      .select("*")
      .neq("name", my_character)
      .gte("elo", mine.elo - 200)
      .lte("elo", mine.elo + 200)
      .order("elo", { ascending: false });

    let opponent;

    if (candidates && candidates.length > 0) {
      // 랜덤 선택 (상위 3명 중)
      const pool = candidates.slice(0, Math.min(3, candidates.length));
      opponent = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // 범위 내 상대가 없으면 아무나
      const { data: all } = await supabase
        .from("characters")
        .select("*")
        .neq("name", my_character)
        .limit(1);

      if (!all || all.length === 0) {
        return {
          content: [{ type: "text", text: "매칭할 상대가 없습니다." }],
        };
      }

      opponent = all[0];
    }

    const eloDiff = Math.abs(mine.elo - opponent.elo);
    const matchInfo = [
      `## ⚔️ 매칭 완료!`,
      ``,
      `| | 캐릭터 A | vs | 캐릭터 B |`,
      `|---|:---:|:---:|:---:|`,
      `| **이름** | ${mine.name} | ⚔️ | ${opponent.name}${opponent.is_npc ? " [NPC]" : ""} |`,
      `| **Elo** | ${mine.elo} | | ${opponent.elo} |`,
      `| **전적** | ${mine.wins}W ${mine.losses}L | | ${opponent.wins}W ${opponent.losses}L |`,
      ``,
      `> Elo 차이: ${eloDiff}`,
      ``,
      `### 캐릭터 설명`,
      `- **${mine.name}**: ${mine.description}`,
      `- **${opponent.name}**: ${opponent.description}`,
    ].join("\n");

    return { content: [{ type: "text", text: matchInfo }] };
  }
);

// 도구 7: 캐릭터 삭제
server.tool(
  "delete_character",
  "본인의 캐릭터를 삭제합니다. NPC는 삭제 불가.",
  {
    name: z.string().describe("삭제할 캐릭터 이름"),
  },
  async ({ name }) => {
    const { data: char } = await supabase
      .from("characters")
      .select("*")
      .eq("name", name)
      .single();

    if (!char) {
      return {
        content: [
          { type: "text", text: `"${name}" 캐릭터를 찾을 수 없습니다.` },
        ],
      };
    }

    if (char.is_npc) {
      return {
        content: [{ type: "text", text: "NPC는 삭제할 수 없습니다." }],
      };
    }

    if (char.owner !== OWNER_ID) {
      return {
        content: [
          {
            type: "text",
            text: `본인 캐릭터만 삭제할 수 있습니다. (소유자: ${char.owner})`,
          },
        ],
      };
    }

    const { error } = await supabase
      .from("characters")
      .delete()
      .eq("name", name);

    if (error) {
      return {
        content: [{ type: "text", text: `삭제 실패: ${error.message}` }],
      };
    }

    return {
      content: [
        { type: "text", text: `캐릭터 "${name}" 삭제 완료.` },
      ],
    };
  }
);

// 서버 시작
const transport = new StdioServerTransport();
await server.connect(transport);
