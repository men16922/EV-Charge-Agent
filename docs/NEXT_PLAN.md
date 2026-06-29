# Next Plan

최종 갱신: 2026-06-28

열린 작업(앞으로 할 일)만 유지하는 rolling plan. 완료 이력은 `docs/COMPLETED_SUMMARY.md`, 상세는 `docs/PROGRESS_LOG.md`.

## Priority 1 — Meet the Builders 제출 (Gen AI Academy APAC, 7월 중 오픈)

상세: `docs/submission/SUBMISSION_PLAN.md`. 제출 타입: blog + video 둘 다.

- [ ] [오늘] LinkedIn **티저(영상만, 링크 없음)** 게시 — `docs/submission/teaser.mp4` + `LINKEDIN_TEASER.md` 캡션.
- [x] 유튜브 풀 데모 영상 최종 편집 및 자막 번인 완료 — [youtube_final.mp4](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/submission/youtube_final.mp4)
- [ ] [7월] **풀 데모 영상** YouTube 업로드 및 아티클 **dev.to**(정본) 발행.
- [ ] [7월] 아티클 **men16922.github.io**(정본) 발행 → canonical 설정 → **Medium** `@men16922` 교차게시(`canonical_url`). 정본 `BLOG_FINAL.md`.
- [ ] [7월] 두 파일 자리표시자 채우기: `<github-url>`/`<youtube-url>`/`<blog-url>`/blog canonical.
- [ ] [선택] 유튜브 화면텍스트(하단자막·엔드카드·제목) 영문 통일 여부 결정(국제 심사 일관성).
- [ ] [7월] 프로그램 페이지에 blog+video URL 제출, LinkedIn 런칭 포스트(요약+링크).

## Priority 2 — 공개 전 안전장치 (Cost Guardrails)

- [ ] [manual] GCP **예산 알림**(예: $20) 설정.
- [ ] [manual] **Google Maps API 키 일일 쿼터**(Routes/Places, 예: 500/일) + API 제한.
- [x] 레이트리밋(IP/분 + 전역 일일 하드캡) 코드 적용 + `--max-instances 1` 배포.

## Priority 3 — 선택 보강

- [ ] [선택] BQML 예측 **타 도시(도쿄 등) 학습** — 현재 ZONE_GANGNAM만.
- [ ] [선택] 티저 길이 단축(스트리밍 구간 배속) / 자막 오버레이.
- [ ] [선택] 접힘 상태 localStorage 기억.
- [ ] [정리] 미사용 `toolbox-froyo`(503) 삭제. 데모 종료 시 Cloud Run 정리로 $0화.
- [ ] [선택] `local_agent_fallback` 견고화(requirements에 sqlalchemy) 또는 폴백 경로 단순화.
