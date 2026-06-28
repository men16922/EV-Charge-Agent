# Agent Brief

최종 갱신: 2026-06-28

이 파일은 EV-Charge EV AI Agent 플랫폼 프로젝트 시작용 압축 문맥이다(≤60줄).

> ▶ NEXT SESSION: 영상·블로그 **정본 스크립트 완료**(`docs/submission/YOUTUBE_SCRIPT_FINAL.md`·`BLOG_FINAL.md`). 다음 액션 = LinkedIn 티저(영상만) 게시 → 7월 발행(YouTube 촬영 + github.io→Medium 아티클, 자리표시자 URL 채우기). 공개 전 예산알림·Maps 일일쿼터 권장. 상세 `docs/NEXT_PLAN.md`.

## Active Work

권위는 `docs/NEXT_PLAN.md`.

1. **OCM APAC 7,842 충전소 BigQuery 적재** + 지오스페이셜·커넥터매칭·라이브상태·하이브리드 라우팅(Google→OSRM)·사각지대·CO₂ 도구.
2. **차 중심 UI**(차종 7종/투명이미지/배터리게이지) + 지도좌·패널우 + 접이식 + 한국어 토글 + **채팅 SSE 스트리밍·라이브 추론 트레이스**.
3. 비용 가드(레이트리밋·max-instances 1) + Cloud Run 재배포 + 제출 문서/티저 영상.

## Read Order

1. 마스터 플랜: [MASTER_PLAN.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/MASTER_PLAN.md)
2. 현재 상태: [STATUS.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/STATUS.md)
3. 다음 작업: [NEXT_PLAN.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/NEXT_PLAN.md)
4. 최신 로그: [PROGRESS_LOG.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/PROGRESS_LOG.md)
5. 비용 최소화 가이드: [COST_MINIMIZATION.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/COST_MINIMIZATION.md)

## Commands

- 기본 검증(gate): `make check`  <!-- harness-config.gate 와 일치시킬 것 -->

## Guardrails

- `deploy.sh` 실행 및 GCP 인프라의 파괴적 작업은 반드시 사용자의 확인([manual])을 받아야 합니다.
