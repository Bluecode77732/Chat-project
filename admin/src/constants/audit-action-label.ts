// 목적: 감사 로그 action 코드(ROLE_CHANGE 등)를 화면용 한글 라벨로 매핑.
// 사용처: dashboard-page, logs-page, users-page의 action 배지와 logs-page의 action 필터 옵션.
// 근거: 세 페이지가 raw 코드를 그대로 표시해 한글 UI와 섞였고, 페이지마다 맵을 복사하면 어긋나기 쉬움.

export const AUDIT_ACTION_LABEL: Record<string, string> = {
    ROLE_CHANGE: '역할 변경',
    FORCE_LOGOUT: '강제 로그아웃',
    USER_DELETE: '사용자 삭제',
    USER_UNBAN: '차단 해제',
    USER_MUTED: '채팅 제한',
    USER_BANNED: '차단',
};
