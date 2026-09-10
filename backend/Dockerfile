# ----- 빌더 스테이지 -----
# alpine 사용, 최신 버전의 리눅스를 개발 환경으로 씀
FROM node:24-alpine AS builder

# pnpm-lock.yaml lockfileVersion과 맞추기 위해 버전 고정.
# @nestjs/cli를 전역 설치함 -- Alpine에서 pnpm이 워크스페이스 내부
# devDependencies를 링크하는 방식과 무관하게 `nest build`를 쓸 수 있도록.
RUN npm install -g pnpm@10.33.0 @nestjs/cli

# 컨테이너 내부의 작업 디렉터리 설정
WORKDIR /app

# 레이어 캐싱을 위해 워크스페이스 레벨 파일을 먼저 복사.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/

# 워크스페이스 전체 의존성 설치
# --shamefully-hoist: 모든 패키지를 루트 node_modules/에 둬 TypeScript가
# backend/에서 디렉터리 walk-up으로 찾을 수 있게 함 (Alpine은 워크스페이스
# 패키지별 node_modules/에 개별 의존성을 심볼릭 링크하지 않음)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# backend 소스 파일 복사
COPY backend/ backend/

# 애플리케이션 빌드
# nest를 pnpm 스크립트가 아니라 직접 실행함 -- Alpine에서 pnpm이 만드는 깨진
# 로컬 .bin/nest 래퍼 대신 전역 @nestjs/cli를 쓰기 위해.
RUN cd backend && nest build


# ----- 프로덕션 스테이지 -----

FROM node:24-alpine AS production

RUN npm install -g pnpm@10.33.0

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/

# --prod로 devDependencies 제외, --filter로 backend 워크스페이스 런타임
# 의존성만 설치 (frontend/admin 제외).
RUN pnpm install --frozen-lockfile --prod --filter backend...

COPY --from=builder /app/backend/dist ./backend/dist

# 애플리케이션 포트 노출
EXPOSE 3000

# compose/Railway가 각자 command로 기동 명령을 지정하므로 기본 CMD는 비활성화.
# CMD ["node", "backend/dist/main"]
