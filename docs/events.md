# 이벤트/메시지 목록 (events.md)

> 서비스 간 비동기 통신에 쓰는 이벤트의 목록과 의미를 정의합니다.
> 실제 스키마(JSON Schema 등)는 `contracts/`에 두고, 여기에는 목적과 흐름을 설명합니다.
> **이벤트는 먼저 정의한 뒤 발행/구독을 구현합니다.** 하위 호환을 깨는 변경은 버전을 올리고 사람에게 먼저 확인합니다.

## 1. 공통 규칙
- 브로커: `<Kafka / RabbitMQ / Redis Pub/Sub>`
- 이벤트 이름: `<도메인.동사(과거형)>` (예: `order.created`)
- 토픽/큐 이름 규칙: `<예: {domain}.{event}.v1>`
- 소비자는 **멱등하게** 처리해야 합니다 (같은 이벤트가 2번 와도 결과가 같아야 함).
- 순서 보장이 필요한 경우 기준 키: `<예: orderId>`

### 공통 이벤트 봉투(envelope)
```json
{
  "eventId": "uuid",
  "eventType": "order.created",
  "version": 1,
  "occurredAt": "2026-01-01T00:00:00Z",
  "producer": "order-service",
  "traceId": "...",
  "data": {}
}
```

## 2. 이벤트 목록
| 이벤트 | 발행 서비스 | 구독 서비스 | 의미 | 스키마 | 버전 |
|---|---|---|---|---|---|
| `<order.created>` | `<order-service>` | `<payment-service>` | `<주문이 생성됨>` | `contracts/events/order.created.v1.json` | 1 |

## 3. 이벤트 상세 (추가하며 작성)
### `<order.created>`
- 발행 시점: `<...>`
- 페이로드(`data`)
```json
{
  "orderId": "string",
  "userId": "string",
  "totalAmount": 0
}
```
- 소비자별 처리: `<서비스: 처리 내용>`
- 실패/재처리 정책: `<재시도 횟수, DLQ(처리 실패 보관 큐) 등>`

## 4. 변경 이력
| 날짜 | 이벤트 | 변경 | 하위 호환 |
|---|---|---|---|
| `<YYYY-MM-DD>` | `<...>` | `<초기 정의>` | - |
