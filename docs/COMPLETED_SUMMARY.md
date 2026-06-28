# Completed Summary

완료된 milestone의 목적·산출물·검증을 짧게 압축 보관한다(상세 이력은 PROGRESS archive).

| ID | Milestone | Result |
| --- | --- | --- |
| M1 | 로컬 개발 및 무지출 검증 (Local Sandbox) | 로컬 PostgreSQL+pgvector 데이터 적재 스크립트 작성, 백엔드 하이브리드 폴백 구현 및 웹 대시보드 연동 완료 |
| M2 | GCP 배포 및 연동 검증 (GCP Deployment) | Cloud Run에 MCP Toolbox 배포, BigQuery ML ARIMA_PLUS 모델 훈련 완료, Vertex AI 연동 및 평가 스위트 통과 |
| M3 | 웹 전체 공개 배포 (Web Stack on Cloud Run) | `ev-charge-web`(Flask UI+에이전트)+`ev-mcp-toolbox`(도구3개) Cloud Run 공개 배포. 데이터 백엔드 BigQuery 단일화(AlloyDB 미사용, scale-to-zero ~$0). UI Google 머티리얼 스타일 교체. 공개 URL에서 상태/매뉴얼/예측 3경로 실데이터 검증 완료 |
| M4 | Predictive Charging Copilot 피벗 + 재배포 | OCM APAC 7,842 충전소 BigQuery 적재. 도구 8종(지오/커넥터매칭/라이브/하이브리드 라우팅 Google→OSRM/사각지대/CO₂). 차종 7종·투명 이미지·배터리 게이지, 지도좌·패널우·접이식·한국어 토글, **채팅 SSE 스트리밍+라이브 추론 트레이스+요청별 세션**, 레이트리밋. rev 00003 공개 재배포·검증. 제출 문서(dev.to/YouTube/LinkedIn)+티저 영상 준비 |
