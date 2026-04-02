# ⚔️ Text Battle

텍스트 배틀 게임 — 300자 이내로 캐릭터를 설계하고, 다른 플레이어와 Elo 기반 매칭으로 배틀합니다.
**Claude Code**와 **OpenAI Codex** 모두 지원합니다.

## 설치

### Claude Code (MCP)

권장 설치 방법:

```bash
npx --package text-battle text-battle-setup
```

이 명령은 자동으로 다음을 처리합니다:

- `~/.claude/settings.json`에 MCP 서버 등록
- `~/.claude/CLAUDE.md`에 배틀 연출 설치
- `TEXT_BATTLE_OWNER`와 `TEXT_BATTLE_SECRET` 설정

`npx`는 로컬에 패키지가 없으면 npm 레지스트리에서 자동으로 내려받아 실행합니다.

설치 후 Claude Code를 재시작하면 MCP 서버 설정이 제대로 반영됩니다.

수동 설정이 필요한 경우:

- `~/.claude/settings.json`
- 또는 Claude Code에서 `/settings` 명령을 열어 붙여넣기

```json
{
  "mcpServers": {
    "text-battle": {
      "command": "npx",
      "args": ["text-battle"],
      "env": {
        "TEXT_BATTLE_OWNER": "your-username",
        "TEXT_BATTLE_SECRET": "your-password"
      }
    }
  }
}
```

- `TEXT_BATTLE_OWNER`: 플레이어 이름 (유니크)
- `TEXT_BATTLE_SECRET`: 비밀번호 (캐릭터 보호용)

이것만 설정하면 끝! DB는 공용 서버를 사용합니다.

### Codex / 기타 AI (CLI)

```bash
npx --package text-battle text-battle-codex-setup
```

이 명령은 자동으로 다음을 처리합니다:

- `AGENTS.md`에 CLI 사용법 설치 (Codex가 자동으로 읽음)
- `~/.text-battle.json`에 인증 정보 저장

### 배틀 연출 설치 (선택, Claude Code 전용)

```bash
npx text-battle-setup
```

배틀 진행 시 스피너 애니메이션 등 연출이 추가됩니다.

## 사용법

### Claude Code에서

```
캐릭터 만들어줘 - 이름: 화염술사, 설명: 근거리에서 폭발적인 화력을 가진 마법사...
배틀 시작!
랭킹 보여줘
```

### Codex에서

세팅 후 똑같이 자연어로 말하면 됩니다. Codex가 AGENTS.md를 읽고 CLI를 자동 실행합니다.

### CLI 직접 사용

```bash
npx --package text-battle text-battle-cli list                    # 캐릭터 목록
npx --package text-battle text-battle-cli get "이름"               # 캐릭터 상세
npx --package text-battle text-battle-cli create "이름" "설명"      # 캐릭터 생성
npx --package text-battle text-battle-cli delete "이름"             # 캐릭터 삭제
npx --package text-battle text-battle-cli match "내캐릭터"          # Elo 매칭
npx --package text-battle text-battle-cli leaderboard              # 랭킹
```

## 게임 규칙

- 300자 이내로 캐릭터를 설계
- "무적", "전지전능" 같은 과장은 오히려 페널티 — **구체성이 곧 힘**
- 독창적이고 구체적인 능력이 유리
- 약점을 명시하는 것은 설계의 깊이를 보여줌
- 물>불, 속도>힘 등 자연스러운 상성 반영
- 강한 캐릭터도 ~30% 확률로 질 수 있음

## 보안

- 비밀번호는 SHA-256 해시로 저장되어 원문이 노출되지 않습니다
- 캐릭터 생성/삭제 시 비밀번호를 검증합니다
- 다른 사람의 캐릭터를 삭제할 수 없습니다

## 도구

### MCP (Claude Code)

| 도구 | 설명 |
|------|------|
| `create_character` | 캐릭터 생성 |
| `list_characters` | 캐릭터 목록 |
| `get_character` | 캐릭터 상세 |
| `find_match` | Elo 기반 자동 매칭 |
| `save_battle` | 배틀 결과 저장 |
| `get_leaderboard` | 랭킹 조회 |
| `delete_character` | 캐릭터 삭제 |

### CLI (Codex / 기타)

| 명령어 | 설명 |
|--------|------|
| `text-battle-cli list` | 캐릭터 목록 |
| `text-battle-cli get <name>` | 캐릭터 상세 |
| `text-battle-cli create <name> <desc>` | 캐릭터 생성 |
| `text-battle-cli delete <name>` | 캐릭터 삭제 |
| `text-battle-cli match <name>` | Elo 매칭 |
| `text-battle-cli save <A> <B> <winner> <sA> <sB> <summary>` | 결과 저장 |
| `text-battle-cli leaderboard` | 랭킹 |

## 라이선스

MIT
