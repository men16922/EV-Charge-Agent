# Status

최종 갱신: 2026-06-28

## Current Baseline

- **공개 배포(라이브)**: `ev-charge-web` Cloud Run revision 00003. 공개 URL https://ev-charge-web-1004528040791.us-central1.run.app — 지도/추천/경로/스트리밍 채팅 동작 (Green). `--max-instances 1`.
- **데이터 = BigQuery**: OCM **APAC 7,842개 충전소**(`ev_charging_stations`, GEOGRAPHY) + 상태/매뉴얼/예측 기존 테이블. AlloyDB 미사용 (Green)
- **에이전트(Gemini 2.5 Flash/ADK)**: 도구 8종 — 근처검색(지오+커넥터매칭+라이브)/경로(Google→OSRM)/사각지대/커뮤니티임팩트/라이브상태 (BigQuery 직접경로) + status/manual/forecast (원격 MCP toolbox) (Green)
- **채팅 = SSE 스트리밍 + 라이브 추론 트레이스 + 요청별 세션** (Green)
- **UI**: 지도(좌)+접이식 패널(우), KPI, 차종 7종(투명 이미지·배터리 게이지), Equity 사각지대, 수요 스파크라인, 한국어 토글 (Green)
- **비용 가드**: 레이트리밋(IP/분 + 전역 일일 하드캡: chat 600/route 500/live 150) (Green)
- **로컬 검증**: Playwright 누적 50+ 케이스 통과. (`make check`는 신규 엔드포인트 미반영 — unverified)

## Active Focus

권위: [NEXT_PLAN.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/NEXT_PLAN.md).

- 7월 Meet the Builders 제출 준비. 영상·블로그 **정본 스크립트 완료**(`docs/submission/*_FINAL.md`). 다음은 LinkedIn 티저(영상만) → 7월 발행. 공개 전 안전장치(예산·Maps 쿼터) 권장.

## Open Risks

- **BQML 예측 범위**: `ev_demand_forecast_model`은 ZONE_GANGNAM만 학습 → 타 도시 혼잡 예측은 에이전트가 일반화. 데모는 서울 기준 정확.
- **공개 비용**: 레이트리밋+max-instances=1로 상한 고정되나, 공개 전 **GCP 예산 알림 + Google Maps API 일일 쿼터** 설정 권장(현재 미설정).
- **폴백 취약점**: `local_agent_fallback`이 `mcp_server_local`(sqlalchemy) import → 웹 이미지 미설치. 주 경로 정상이라 영향 없음.
- **모델 권한**: Gemini 3.x 접근 불가(2.5만) — [DECISIONS.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/DECISIONS.md).
