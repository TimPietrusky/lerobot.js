import { cn } from "@/lib/utils";

interface VirtualKeyProps {
  label: string;
  subLabel?: string;
  isPressed?: boolean;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  disabled?: boolean;
}

const VirtualKey = ({
  label,
  subLabel,
  isPressed,
  onMouseDown,
  onMouseUp,
  disabled,
}: VirtualKeyProps) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && onMouseDown) {
      onMouseDown();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && onMouseUp) {
      onMouseUp();
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && onMouseUp) {
      onMouseUp();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "w-12 h-12 border rounded-md flex items-center justify-center font-bold transition-all duration-100",
          "select-none user-select-none",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled &&
            (onMouseDown || onMouseUp) &&
            "cursor-pointer hover:bg-white/5",
          isPressed
            ? "bg-primary text-primary-foreground scale-110 border-primary"
            : "bg-black/30 text-muted-foreground border-white/10"
        )}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {label}
      </div>
      {subLabel && (
        <span className="text-xs text-muted-foreground mt-1 font-mono">
          {subLabel}
        </span>
      )}
    </div>
  );
};

export default VirtualKey;
