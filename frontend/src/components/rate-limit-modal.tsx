interface Props {
    secondsLeft: number;
}

export default function RateLimitModal({ secondsLeft }: Props) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div data-testid="rate-limit-modal" className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full text-center">
                <h2 className="text-lg font-bold mb-1">전송 제한</h2>
                <p className="text-sm text-gray-500 mt-2">
                    1분 내에 보낼 수 있는 메시지 수를 초과했어요.
                </p>
                <p className="text-2xl font-bold text-blue-500 mt-3">{secondsLeft}초</p>
                <p className="text-xs text-gray-400 mt-1">후에 다시 보낼 수 있습니다.</p>
            </div>
        </div>
    );
}
