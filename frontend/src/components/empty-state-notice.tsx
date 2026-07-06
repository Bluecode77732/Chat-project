import type { CSSProperties } from 'react';

interface Props {
    text: string;
    colorClass: string;
    testId: string;
    onDismiss?: () => void;
    noWrapper?: boolean;
    spanClassName?: string;
    spanStyle?: CSSProperties;
}

export default function EmptyStateNotice({ text, colorClass, testId, onDismiss, noWrapper, spanClassName, spanStyle }: Props) {
    const pill = (
        <span
            data-testid={testId}
            className={spanClassName ?? `relative inline-flex items-center text-xs rounded-full py-2 ${colorClass} ${onDismiss ? 'pl-4 pr-7' : 'px-4'}`}
            style={spanStyle}
        >
            {text}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    data-testid={`${testId}-close`}
                    aria-label="닫기"
                    className="absolute top-1.5 right-3 opacity-60 hover:opacity-100 leading-none text-xs"
                >
                    ✕
                </button>
            )}
        </span>
    );

    return noWrapper ? pill : <div className="flex-1 flex items-center justify-center">{pill}</div>;
}
