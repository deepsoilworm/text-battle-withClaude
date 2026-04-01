# ⚔️ Text Battle

Claude Code MCP 서버로 동작하는 텍스트 배틀 게임입니다.
300자 이내로 캐릭터를 설계하고, 다른 플레이어의 캐릭터와 Elo 기반 매칭으로 배틀합니다.

## 설치

### 1. MCP 서버 등록

Claude Code 설정 파일에 추가:

```json
{
  "mcpServers": {
    "text-battle": {
      "command": "npx",
      "args": ["text-battle"],
      "env": {
        "TEXT_BATTLE_SUPABASE_URL": "your-supabase-url",
        "TEXT_BATTLE_SUPABASE_KEY": "your-supabase-anon-key",
        "TEXT_BATTLE_OWNER": "your-username"
      }
    }
  }
}
```

### 2. 배틀 연출 설치 (선택)

```bash
npx text-battle-setup
```

배틀 진행 시 스피너 애니메이션 등 연출이 추가됩니다.

## 사용법

Claude Code에서:

```
캐릭터 만들어줘 - 이름: 화염술사, 설명: 근거리에서 폭발적인 화력을 가진 마법사...
배틀 시작!
랭킹 보여줘
```

## 게임 규칙

- 300자 이내로 캐릭터를 설계
- "무적", "전지전능" 같은 과장은 오히려 페널티 — **구체성이 곧 힘**
- 독창적이고 구체적인 능력이 유리
- 약점을 명시하는 것은 설계의 깊이를 보여줌
- 물>불, 속도>힘 등 자연스러운 상성 반영
- 강한 캐릭터도 ~30% 확률로 질 수 있음

## MCP 도구

| 도구 | 설명 |
|------|------|
| `create_character` | 캐릭터 생성 |
| `list_characters` | 캐릭터 목록 |
| `get_character` | 캐릭터 상세 |
| `find_match` | Elo 기반 자동 매칭 |
| `save_battle` | 배틀 결과 저장 |
| `get_leaderboard` | 랭킹 조회 |
| `delete_character` | 캐릭터 삭제 |

## 환경변수

| 변수 | 설명 |
|------|------|
| `TEXT_BATTLE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `TEXT_BATTLE_SUPABASE_KEY` | Supabase anon key |
| `TEXT_BATTLE_OWNER` | 플레이어 고유 ID (GitHub 유저네임 등) |

## 라이선스

MIT
