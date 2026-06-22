interface Props {
    secondsLeft: number;
}

export default function RateLimitNotice({ secondsLeft }: Props) {
    return (
        <p data-testid="rate-limit-notice" className="text-xs text-red-500 mb-1">
            메시지 전송 제한 — {secondsLeft}초 후 다시 보낼 수 있어요.
        </p>
    );
}
