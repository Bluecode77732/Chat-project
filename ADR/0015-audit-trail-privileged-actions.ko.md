# 0015: 모든 권한 있는 작업/제재 조치에 대한 감사 로그

## 상태

Accepted

## 배경

권한 있는 작업(역할 변경, 강제 로그아웃, 사용자 삭제)과 자동화된 모더레이션 제재(뮤트, 차단,
차단 해제)는 다른 사용자의 접근 권한이나 상태를 바꿉니다. 애플리케이션 로그(`winston`,
로테이션되며 구조화되지 않음)는 디버깅용이지 책임 추적용이 아니라서, "누가 누구에게 무엇을
했는가"에 대한 신뢰할 수 있고 조회 가능한 기록이 되지 못합니다.

## 결정

`AuditLogService.log(actorId, targetId, action, detail?)`가 이런 작업 하나하나를 애플리케이션
로그 스트림과 별개인, 조회 가능한 엔티티로 기록합니다.

- `UserService`: `'ROLE_CHANGE'`(`user.service.ts:293-298`), `'FORCE_LOGOUT'`
  (`user.service.ts:323`), `'USER_DELETE'`(`user.service.ts:419`) — `actorId`는 해당 작업을
  수행한 관리자입니다.
- `ModerationService`: `'USER_MUTED'`(`moderation.service.ts:253-258`), `'USER_BANNED'`
  (`moderation.service.ts:287-292`), `'USER_UNBAN'`(`moderation.service.ts:189`) — `actorId`는
  `getSystemUserId()`입니다. 사람 관리자가 아니라 자동화된 제재이기 때문인데, 감사 로그는
  `actorId`를 null로 두거나 항목을 생략하는 대신 시스템 계정에 귀속시킵니다.
- `AuditLogService.countByTarget(userId, 'USER_BANNED')`(`moderation.service.ts:272-275`)는
  `applyBan`이 같은 사용자에 대한 재차 차단을 영구 차단으로 격상할지 판단할 때 다시
  읽습니다. 즉 감사 로그는 한 번 쓰고 잊는 append-only 기록이 아니라 읽기 쪽 상태로도
  소비됩니다.
- 관리자용 감사 로그 CSV 내보내기는 README의 [Admin 패널](../README.ko.md#admin-패널) 절에
  명시된 `admin/`의 기능 중 하나입니다.
- 고려했다가 배제한 대안:
  - **winston 애플리케이션 로그에만 의존**: 배경 절에서 서술한 기존 결함 그 자체라 실행
    가능한 선택지가 아닙니다. 로그는 로테이션되고 구조화되지 않아 "누가 누구에게 이걸
    했는가"에 답하도록 만들어진 적이 없고, 사후에 신뢰할 수 있는 이력으로 재구성할 수
    없습니다.
  - **시스템이 트리거한 제재의 `actorId`를 null로 두기(혹은 항목 자체를 생략)**:
    배제했습니다. 나중에 관리자가 "왜 이 사용자가 제재됐는지" 설명해야 할 수도 있는 자동화된
    행위(뮤트/차단/차단해제)에서 null actor는 "누가 이걸 했는가" 보장을 정확히 그 지점에서
    깨뜨립니다. `getSystemUserId()`는 모든 항목을 귀속 가능하게 유지합니다.

## 결과

- 새로운 권한 있는 작업(역할 변경, 강제 로그아웃, 삭제, 차단, 뮤트, 차단 해제, 향후의 제재
  유형)은 반드시 `AuditLogService.log()`를 호출해야 합니다. 사람이 트리거했든 자동이든, 감사
  항목 없는 권한 있는 뮤테이션을 추가하면 안 됩니다.
- 자동화/시스템이 트리거한 작업은 `actorId`를 null로 두지 말고 반드시 `getSystemUserId()`로
  귀속시켜야 합니다. actor가 null이면, 시스템이 시작한 제재라 해도 감사 로그가 보장해야 할
  "누가 이걸 했는가"가 깨집니다.
- 새 작업이 결정을 내리기 위해 감사 이력을 읽어야 한다면(예: `applyBan`의 재범자 격상 판단)
  다른 소스에서 그 상태를 다시 유도하지 말고
  `AuditLogService.countByTarget()`이나 그에 준하는 조회 메서드를 써야 합니다. 작업 이력의
  단일 기준은 감사 로그입니다.
