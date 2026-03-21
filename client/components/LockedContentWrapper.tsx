import { Lock } from "lucide-react";

interface LockedContentWrapperProps {
  isLocked: boolean;
  children: React.ReactNode;
  lockedMessage?: string;
}

export default function LockedContentWrapper({
  isLocked,
  children,
  lockedMessage = "Este contenido estará disponible después de confirmar tu abono",
}: LockedContentWrapperProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[300px]">
      {/* Blurred Content - with strong backdrop blur */}
      <div className="backdrop-blur-lg blur-md pointer-events-none">{children}</div>

      {/* Lock Overlay - Full coverage with semi-transparent background */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/50 to-black/30 dark:from-black/60 dark:to-black/40 rounded-lg">
        <div className="text-center space-y-3 px-4">
          <div className="flex justify-center">
            <div className="p-3 bg-amber-400/10 dark:bg-amber-500/10 rounded-full">
              <Lock className="w-12 h-12 text-amber-400 dark:text-amber-300" />
            </div>
          </div>
          <p className="text-gray-200 dark:text-gray-300 text-sm md:text-base font-medium max-w-xs">
            {lockedMessage}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Completa el pago para desbloquear
          </p>
        </div>
      </div>
    </div>
  );
}
