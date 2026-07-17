# 0005: 환경변수 하나로 관리하는 CORS 멀티 오리진 허용 목록

## 상태

Accepted

## 배경

두 개의 별도 프론트엔드 배포(`frontend/` 채팅 클라이언트, `admin/` 관리 대시보드)가 각각 자신의
오리진에서 실행되며, 둘 다 httpOnly `refreshToken` 쿠키를 크로스 오리진으로 보내야 합니다. 이를
위해서는 `credentials: true`와 정확한 오리진 허용 목록이 필요하며 — `origin: '*'`는 자격 증명이
포함된 요청과 애초에 호환되지 않고, 이 프로젝트에서는 어떤 상황에서도 Never Do입니다.

## 결정

- `CORS_ORIGIN`(`backend/src/app.module.ts:37`에서 `Joi.string().pattern(/\S/).required()`로
  검증 — 이 패턴 검사는 `.required()`만으로는 통과했을 공백 문자열을 특별히 걸러내어, 빈 허용
  목록이 만들어지는 것을 막습니다)은 허용된 오리진들을 콤마로 구분한 목록을 담는 환경변수
  하나입니다.
- `backend/src/main.ts:47`에서 이를 배열로 분리한 뒤(`.split(',').map(origin => origin.trim())`)
  `app.enableCors({ origin, credentials: true, ... })`에 전달합니다.
- 로컬 개발 기본값은 `frontend/`(`:5173`)와 `admin/`(`:5174`) 둘 다를 커버합니다. 예시 값은
  `backend/.env.example`을 참고하세요.
- 두 프론트엔드 모두 httpOnly `refreshToken` 쿠키(`withCredentials` / `credentials: 'include'`)에
  의존하므로 `credentials: true`가 함께 필요합니다.

## 결과

- `origin: '*'`는 절대 제안하지 않습니다 — `credentials: true`와 호환되지 않고 허용 목록의 목적
  자체를 무력화합니다.
- `CORS_ORIGIN`을 읽는 대신 `main.ts`에 오리진을 직접 하드코딩하는 것도 절대 제안하지 않습니다 —
  허용 목록에 대한 두 번째 진실 공급원이 생겨버립니다.
- 세 번째 프론트엔드/admin 소비자(예: 향후의 모바일 웹 클라이언트)를 추가하려면 모든 배포 환경에서
  `CORS_ORIGIN`에 해당 오리진을 반드시 추가해야 합니다 — 빠뜨리면 동작하지 않으며 폴백은 없습니다.
