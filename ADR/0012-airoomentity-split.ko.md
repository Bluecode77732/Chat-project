# 0012: `RoomEntity`에서 `AiRoomEntity`를 분리

## 상태

Accepted

## 배경

룸의 활성 AI 성격(personality)은 원래 `RoomEntity`에 직접 붙은 nullable `aiPersonality`
컬럼이었습니다. 그래서 AI 동반자 룸이든 순수 사람 대 사람 룸이든, 모든 룸이 AI 전용 필드를
들고 있었습니다.

## 결정

마이그레이션 `ExtractAiPersonalityToAiRoomEntity`(`1749639600000`)가 성격 필드를 별도의
`AiRoomEntity`로 옮겼습니다. `RoomEntity`와는 `onDelete: 'CASCADE'`가 걸린 `OneToOne` 관계로
연결됩니다.

- **이유:** AI 기능이 커지면서 AI 전용 룸 상태와 일반 룸 상태의 관심사를 분리하고, 그 데이터를
  더 깔끔하게 관리하기 위해서였습니다(개발자 본인 설명).
- 고려했다가 배제한 대안:
  - **`aiPersonality`를 `RoomEntity`의 nullable 컬럼으로 유지**(마이그레이션 이전 상태):
    배제했습니다. AI를 전혀 쓰지 않는 순수 사람 대 사람 룸까지 포함해, 모든 룸이 항상
    `null`인 안 쓰는 컬럼을 계속 들고 다니게 됩니다.
  - **`OneToOne` 분리 엔티티 대신, `RoomEntity`에 다대일 외래키를 건 별도 조회 테이블**:
    배제했습니다. 룸은 한 번에 활성 AI 성격을 최대 하나만 가지므로, 다대일 구조에서 그
    불변식을 강제하려면 `OneToOne`이 공짜로 보장해주는 것을 별도 유니크 제약으로 다시
    추가해야 합니다.

## 결과

- `RoomEntity`에는 모든 룸에 해당하지 않는 AI 전용 컬럼이 없는 상태가 유지됩니다. 앞으로 AI
  룸에만 해당하는 필드(예: 룸별 대화 이력 상한 오버라이드)는 `RoomEntity`가 아니라
  `AiRoomEntity`에 두어야 합니다.
- `OneToOne` 관계의 `onDelete: 'CASCADE'`는 `RoomEntity`를 삭제하면 딸린 `AiRoomEntity` 행도
  자동 삭제된다는 뜻입니다. AI 룸 설정을 읽는 새 쿼리는 `AiRoomEntity`가 항상 존재한다고
  가정하지 말고, 존재하지 않는 경우(AI가 아닌 룸)를 반드시 처리해야 합니다.
- "조인을 단순화한다"는 이유로 AI 전용 필드를 다시 `RoomEntity`로 합치는 것은 절대 제안하지
  않습니다. 이 분리가 고치려던 문제 — 쓰지도 않는 AI 컬럼을 모든 룸이 들고 다니는 것 — 가
  도로 생깁니다.
