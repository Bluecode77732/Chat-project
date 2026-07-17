# 0012: `RoomEntity`에서 `AiRoomEntity`를 분리

## 상태

Accepted

## 배경

룸의 활성 AI 성격(personality)은 원래 `RoomEntity`에 직접 있는 nullable `aiPersonality` 컬럼이었습니다
— AI 동반자 룸이든 순수 사람 대 사람 룸이든 모든 룸이 AI 전용 필드를 갖고 있었습니다.

## 결정

마이그레이션 `ExtractAiPersonalityToAiRoomEntity`(`1749639600000`)가 성격 필드를 별도의
`AiRoomEntity`로 옮겼고, `onDelete: 'CASCADE'`가 걸린 `OneToOne` 관계로 `RoomEntity`와 연결됩니다.

- **이유:** AI 기능이 커지면서, AI 전용 룸 상태와 일반 룸 상태 사이의 관심사 분리, 그리고 그
  데이터를 계속 관리하기 더 깔끔하게 하기 위해서였습니다(개발자 본인 설명).

## 결과

- `RoomEntity`는 모든 룸에 적용되지 않는 AI 전용 컬럼으로부터 자유로운 상태를 유지합니다 — 향후
  AI 룸에만 해당하는 필드(예: 룸별 대화 이력 상한 오버라이드)는 `RoomEntity`가 아니라
  `AiRoomEntity`에 있어야 합니다.
- `OneToOne` 관계의 `onDelete: 'CASCADE'`는 `RoomEntity`를 삭제하면 그에 딸린 `AiRoomEntity` 행도
  자동으로 삭제된다는 뜻입니다 — AI 룸 설정을 읽는 새 쿼리는 `AiRoomEntity`가 항상 존재한다고
  가정하지 말고, 존재하지 않는 경우(AI가 아닌 룸)를 반드시 처리해야 합니다.
- "조인을 단순화한다"는 이유로 AI 전용 필드를 다시 `RoomEntity`로 합치는 것은 절대 제안하지
  않습니다 — 이 분리가 애초에 고치려던, 모든 룸이 쓰지도 않는 AI 컬럼을 들고 다니는 문제가 다시
  생깁니다.
