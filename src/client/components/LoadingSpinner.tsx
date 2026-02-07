interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

export default function LoadingSpinner({ fullScreen = false, message }: LoadingSpinnerProps) {
  const containerClasses = fullScreen
    ? "min-h-screen flex items-center justify-center bg-[#0b0b0b] text-white"
    : "flex items-center justify-center";

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        <div className="size-9 animate-spin rounded-full border-4 border-white/15 border-t-[#E50914]" />
        {message ? <p className="text-sm text-white/60">{message}</p> : null}
      </div>
    </div>
  );
}
