import { useApp } from '@/context/AppContext';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    info: <Info className="w-5 h-5 text-amber-700" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  };

  const borders = {
    success: 'border-l-emerald-600',
    info: 'border-l-amber-600',
    warning: 'border-l-amber-500',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`card flex items-center gap-3 px-4 py-3 border-l-4 ${borders[toast.type]} min-w-[300px] max-w-md`}>
        {icons[toast.type]}
        <p className="text-sm text-stone-800 flex-1">{toast.message}</p>
      </div>
    </div>
  );
}
