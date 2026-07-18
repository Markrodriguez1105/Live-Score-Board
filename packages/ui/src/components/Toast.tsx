import React, { useState, useCallback, createContext, useContext } from "react";

// === Toast Types ===

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

// === Toast Provider & Container ===

interface ToastProps {
  children: React.ReactNode;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-600/90 border-green-500",
  error: "bg-red-600/90 border-red-500",
  info: "bg-indigo-600/90 border-indigo-500",
  warning: "bg-amber-600/90 border-amber-500",
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

let toastId = 0;

export const Toast: React.FC<ToastProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3
              rounded-xl border backdrop-blur-md shadow-xl
              text-white text-sm font-medium
              ${typeStyles[t.type]}
            `}
            style={{
              animation: "toastIn 300ms ease-out",
            }}
            onClick={() => removeToast(t.id)}
          >
            <span className="text-base">{typeIcons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
