# services

백엔드 서비스가 서비스별 폴더로 들어가는 곳입니다. (예: `user-service/`, `order-service/`)

- 서비스마다 독립 빌드·테스트·Dockerfile, 독립 DB를 가집니다.
- 다른 서비스의 DB·코드에 직접 접근하지 않고, `contracts/`의 계약(API·이벤트)으로만 통신합니다.
- 담당 에이전트: backend (작업할 서비스 이름을 지정해서 위임)
