import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, X } from 'lucide-react';

const appWindow = getCurrentWindow();

interface TitleBarProps {
  title?: string;
  onClose?: () => void;
  showMinimize?: boolean;
}

export default function TitleBar({ title = 'INBOXTRAY', onClose, showMinimize = true }: TitleBarProps) {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      appWindow.hide();
    }
  };

  return (
    <div 
      className="h-9 flex items-center justify-between px-4 bg-app-surface border-b border-app-border select-none"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-app-warning text-xs">◆</span>
        <span className="text-xs font-display text-app-accent-hover tracking-widest" data-tauri-drag-region>
          {title}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        {showMinimize && (
          <button
            onClick={() => appWindow.minimize()}
            className="w-6 h-6 flex items-center justify-center hover:bg-app-accent-soft rounded transition-colors"
          >
            <Minus size={12} className="text-app-accent/60" />
          </button>
        )}
        <button
          onClick={handleClose}
          className="w-6 h-6 flex items-center justify-center hover:bg-app-danger/20 rounded transition-colors"
        >
          <X size={12} className="text-app-accent/60 hover:text-app-danger" />
        </button>
      </div>
    </div>
  );
}
