# 0005: 환경변수 하나로 관리하는 CORS 멀티 오리진 허용 목록

## 상태

Accepted

## 배경

프론트엔드 배포가 두 개(`frontend/` 채팅 클라이언트, `admin/` 관리 대시보드)이고 각각 자기
오리진에서 실행되는데, 둘 다 httpOnly `refreshToken` 쿠키를 크로스 오리진으로 보내야 합니다.
그러려면 `credentials: true`와 정확한 오리진 허용 목록이 필요합니다. `origin: '*'`는 자격 증명이
포함된 요청과 애초에 호환되지 않으며, 이 프로젝트에서는 어떤 상황에서도 Never Do입니다.

## 결정

- `CORS_ORIGIN`(`backend/src/app.module.ts:39`에서 `Joi.string().pattern(/\S/).required()`로
  검증)은 허용된 오리진들을 콤마로 구분해 담는 환경변수 하나입니다. 이 패턴 검사는
  `.required()`만으로는 통과했을 공백 문자열을 걸러내어, 빈 허용 목록이 만들어지는 것을 막습니다.
- `backend/src/main.ts:60`에서 이 값을 배열로 분리하고(`.split(',').map(origin => origin.trim())`),
  `main.ts:57`에서 시작하는 `app.enableCors({ ... })` 호출의 `origin` 속성값으로 바로 넣습니다.
- 로컬 개발 기본값은 `frontend/`(`:5173`)와 `admin/`(`:5174`)을 둘 다 커버합니다. 예시 값은
  `backend/.env.example`을 참고하세요.
- 두 프론트엔드 모두 httpOnly `refreshToken` 쿠키(`withCredentials` / `credentials: 'include'`)에
  의존하므로 `credentials: true`가 함께 필요합니다.
- 고려했다가 배제한 대안:
  - **앱별로 CORS 설정을 두 개 두고 요청 시점에 분기**: 배제했습니다. 어느 프론트엔드가
    호출했는지 백엔드가 먼저 식별해야 올바른 정책을 고를 수 있는데, 콤마 구분 허용 목록
    하나면 정적으로 끝나는 문제입니다.
  - **`origin: '*'` + `credentials: false`**(쿠키 기반 인증을 포기하고 와일드카드 허용):
    배제했습니다. `frontend`와 `admin`이 둘 다 의존하는 httpOnly `refreshToken` 흐름이 깨지고,
    인증 방식 자체를 통째로 바꿔야 합니다.
  - **와일드카드/정규식 오리진 매칭**(예: `*.vercel.app` 서브도메인 전부 허용): 배제했습니다.
    이 프로젝트의 알려진 배포 두 개만이 아니라 Vercel에 호스팅된 아무 앱이나 요청을 보낼 수
    있게 되어 지나치게 허용적입니다.

## 결과

- `origin: '*'`는 절대 제안하지 않습니다. `credentials: true`와 호환되지 않고, 허용 목록의 목적
  자체를 무력화합니다.
- `CORS_ORIGIN`을 읽는 대신 `main.ts`에 오리진을 하드코딩하는 것도 절대 제안하지 않습니다.
  허용 목록의 기준이 두 곳으로 갈라지기 때문입니다.
- 세 번째 프론트엔드/admin 소비자(예: 향후 모바일 웹 클라이언트)를 추가할 때는 모든 배포 환경의
  `CORS_ORIGIN`에 해당 오리진을 반드시 추가해야 합니다. 빠뜨리면 동작하지 않으며 폴백은 없습니다.
