# contracts

서비스 간 계약을 두는 폴더입니다. (OpenAPI, proto, 이벤트 JSON Schema 등)

- API·이벤트는 여기에 먼저 정의한 뒤 구현합니다.
- 하위 호환을 깨는 변경은 버전을 올리고 사람에게 먼저 확인합니다.
- 담당 에이전트: planner (계약 변경 요청은 planner에게)
