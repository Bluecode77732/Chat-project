interface Props {
    text: string;
    colorClass: string;
    testId: string;
    onDismiss?: () => void;
}

export default function EmptyStateNotice({ text, colorClass, testId, onDismiss }: Props) {
    return (
        <div className="flex-1 flex items-center justify-center">
            <span
                data-testid={testId}
                className={`relative inline-flex items-center text-xs rounded-full py-2 ${colorClass} ${onDismiss ? 'pl-4 pr-7' : 'px-4'}`}
            >
                {text}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        data-testid={`${testId}-close`}
                        aria-label="닫기"
                        className="absolute top-1 right-2 opacity-60 hover:opacity-100 leading-none"
                    >
                        ✕
                    </button>
                )}
            </span>
        </div>
    );
}
