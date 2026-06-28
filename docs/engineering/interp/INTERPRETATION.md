# Engineering Interpretation — <PROJECT>

이 문서는 `docs/engineering/*_ENGINEERING.md` **바이블(범용 개념)** 을 **이 repo의 실제 파일·명령·메커니즘에 매핑**한다.
바이블은 "무엇/왜"(portable), 이 문서는 "이 repo에서 어떻게"(repo별). 각 절을 채워라.

## HARNESS — 성숙도/검증/권한 (바이블 `HARNESS_ENGINEERING.md`)
- gate(검증): `<make check 등 — harness-config.gate>`
- 권한 경계: `scripts/overnight/overnight-settings.json` (allow=이 repo gate 타깃, deny=파괴/온라인)
- 성숙도 현 위치 / 다음 투자처: <...>

## LOOP — 무인 루프 (바이블 `LOOP_ENGINEERING.md`)
- 러너: `scripts/overnight/run.sh` (단일 엔진 claude). env: `GATE_CMD`/`MAX_ITER`/`PAUSE`/...
- 백로그 태그: `[auto]`/`[manual]`/`[blocked]` in `<NEXT_PLAN 경로>`
- 회차 프롬프트: `scripts/overnight/PROMPT.md`
- skills: `/sync` `/checkpoint` `/overnight-report` `/overnight-seed` (플러그인 제공)

## AGENTIC — 멀티에이전트 (바이블 `AGENTIC_ENGINEERING.md`)
- 현재 단일 엔진. (멀티 도입 시) 레인/도메인 분할·worktree 격리·builder≠reviewer를 여기 매핑.

## CONTEXT — 컨텍스트/문서 규율 (바이블 `CONTEXT_ENGINEERING.md`)
- 진입점/Read Path: `<AGENT_BRIEF>` → `<STATUS>` → `<NEXT_PLAN>` → `<PROGRESS_LOG>`
- 라인 예산: brief ≤60 · status/plan/log ≤120 (harness-config.budgets)
- Resume Pointer: `<AGENT_BRIEF>` 최상단 `▶ NEXT SESSION` 한 줄
- archive: `<docs/archive/...>`

## PROMPT — 프롬프트 레이어 (바이블 `PROMPT_ENGINEERING.md`)
- 하네스 프롬프트: `scripts/overnight/PROMPT.md`
- 런타임/도메인 프롬프트: `<이 repo가 LLM을 쓰면 그 경로; 아니면 N/A>`
