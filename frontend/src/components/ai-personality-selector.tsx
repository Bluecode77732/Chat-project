interface PersonalityOption {
    value: string;
    label: string;
    description: string;
}

const PERSONALITY_OPTIONS: PersonalityOption[] = [
    { value: 'FRIENDLY', label: '친절한 어시스턴트', description: '일반 Q&A, 편안한 말투' },
    { value: 'CODING',   label: '코드 도우미',       description: '프로그래밍 전문, 코드 예시 중심' },
    { value: 'ENGLISH',  label: '영어 선생님',       description: '영작 교정, 문법 설명' },
    { value: 'CREATIVE', label: '창의적인 작가',     description: '스토리, 글쓰기 도움' },
];

interface Props {
    currentPersonality?: string | null;
    canChange: boolean;
    onSelect: (personality: string) => void;
    onClose: () => void;
    isInitial: boolean;
}

export default function AiPersonalitySelector({
    currentPersonality,
    canChange,
    onSelect,
    onClose,
    isInitial,
}: Props) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
                <h2 className="text-lg font-bold mb-1">
                    {isInitial ? 'AI 성격 선택' : 'AI 성격 변경'}
                </h2>
                {!isInitial && !canChange && (
                    <p className="text-xs text-red-500 mb-3">
                        성격은 1회만 변경할 수 있어요.
                    </p>
                )}
                {!isInitial && canChange && (
                    <p className="text-xs text-gray-400 mb-3">
                        변경은 1회만 가능합니다.
                    </p>
                )}
                <div className="flex flex-col gap-2 mt-2">
                    {PERSONALITY_OPTIONS.map((opt) => {
                        const isActive = opt.value === currentPersonality;
                        const disabled = !isInitial && !canChange;
                        return (
                            <button
                                key={opt.value}
                                disabled={disabled}
                                onClick={() => {
                                    if (!disabled) onSelect(opt.value);
                                }}
                                data-testid={`personality-option-${opt.value.toLowerCase()}`}
                                className={`text-left p-3 rounded-lg border transition-colors ${
                                    isActive
                                        ? 'border-blue-500 bg-blue-50'
                                        : disabled
                                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                }`}
                            >
                                <div className="font-medium text-sm">{opt.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={onClose}
                    data-testid="personality-close-button"
                    className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600"
                >
                    닫기
                </button>
            </div>
        </div>
    );
}
