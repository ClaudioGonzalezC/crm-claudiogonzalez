import { ReactNode } from 'react';
import Logo from '@/components/Logo';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  rightContent?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  rightContent,
}: PageHeaderProps) {
  return (
    <header className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40">
      <div className="w-full">
        {/* Logo Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            {rightContent}
          </div>
        </div>

        {/* Title Section - only show if title is provided */}
        {title && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-slate-700/30">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-white">{title}</h1>
                {subtitle && (
                  <p className="text-gray-400 mt-2">{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-3 mt-1">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
