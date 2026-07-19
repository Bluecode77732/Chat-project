# 0015: 모든 권한 있는 작업/제재 조치에 대한 감사 로그

## 상태

Accepted

## 배경

권한 있는 작업(역할 변경, 강제 로그아웃, 사용자 삭제)과 자동화된 모더레이션 제재(음소거, 차단,
차단 해제)는 다른 사용자의 접근 권한이나 상태를 변경합니다. 애플리케이션 로그(`winston`, 로테이션
되고 구조화되지 않음)는 누가 누구에게 무엇을 했는지에 대한 신뢰할 수 있거나 조회 가능한 기록이
아닙니다 — 이는 책임 추적용이 아니라 디버깅용입니다.

## 결정

`AuditLogService.log(actorId, targetId, action, detail?)`가 이런 작업 하나하나를 애플리케이션
로그 스트림과는 별개인, 조회 가능한 엔티티로 기록합니다.

- `UserService`: `'ROLE_CHANGE'`(`user.service.ts:293-298`), `'FORCE_LOGOUT'`
  (`user.service.ts:323`), `'USER_DELETE'`(`user.service.ts:419`) — `actorId`는 해당 작업을
  수행한 관리자입니다.
- `ModerationService`: `'USER_MUTED'`(`moderation.service.ts:253-258`), `'USER_BANNED'`
  (`moderation.service.ts:287-292`), `'USER_UNBAN'`(`moderation.service.ts:189`) — `actorId`는
  `getSystemUserId()`입니다. 이는 사람 관리자의 작업이 아니라 자동화된 제재 조치이기 때문이며,
  감사 로그는 `actorId`를 null로 두거나 항목을 아예 생략하는 대신 시스템 계정에 귀속시킵니다.
- `AuditLogService.countByTarget(userId, 'USER_BANNED')`(`moderation.service.ts:272-275`)는
  `applyBan`이 동일 사용자에 대한 재차 차단을 영구 차단으로 격상할지 판단하기 위해 다시 읽어들입니다
  — 감사 로그는 한 번 쓰고 무시되는 append-only 기록이 아니라 읽기 쪽 상태로도 소비됩니다.
- admin 대상 감사 로그 CSV 내보내기는 README의 [Admin 패널](../README.ko.md#admin-패널) 절에
  명시된 `admin/`의 기능 중 하나입니다.
- 고려했다가 배제한 대안:
  - **winston 애플리케이션 로그에만 의존**: 이건 배경 절에서 서술한 기존 결함 자체이지, 실행
    가능한 선택지가 아닙니다 — 로그는 로테이션되고 구조화되지 않아서, "누가 누구에게 이걸 했는가"에
    답하도록 만들어진 적이 없어 사후에 신뢰할 수 있는 이력으로 재구성할 수 없습니다.
  - **시스템이 트리거한 제재에 대해 `actorId`를 null로 두거나(혹은 항목 자체를 생략)**: 배제 —
    null actor는 정확히 나중에 관리자가 "왜 이 사용자가 제재됐는지" 설명해야 할 수도 있는 자동화된
    행위(뮤트/차단/차단해제)에 대해 "누가 이걸 했는가" 보장을 깨뜨립니다. `getSystemUserId()`는
    모든 항목을 계속 귀속 가능하게 유지합니다.

## 결과

- 새로운 권한 있는 작업(역할 변경, 강제 로그아웃, 삭제, 차단, 음소거, 차단 해제, 혹은 향후의
  제재 유형)은 반드시 `AuditLogService.log()`를 호출해야 합니다 — 사람이 트리거했든 자동화된
  것이든, 감사 항목 없이 권한 있는 뮤테이션을 추가하면 안 됩니다.
- 자동화/시스템이 트리거한 작업은 `actorId`를 null로 두지 말고 반드시 `getSystemUserId()`로
  귀속시켜야 합니다 — actor가 null이면 시스템이 시작한 제재라 하더라도 감사 로그가 보장해야 할
  "누가 이걸 했는가"가 깨집니다.
- 새 작업이 결정을 내리기 위해 감사 이력을 다시 읽어야 한다면(예: `applyBan`이 재범자 격상을
  위해 하는 것처럼) 다른 소스에서 그 상태를 다시 유도하지 말고
  `AuditLogService.countByTarget()`이나 그에 준하는 조회 메서드를 사용해야 합니다 — 감사 로그가
  작업 이력의 단일 진실 공급원입니다.
