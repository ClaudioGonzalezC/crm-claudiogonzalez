import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Determine navigation destination based on current context
  const getLinkHref = () => {
    // If in a public customer portal (cliente route), don't link anywhere
    if (location.pathname.startsWith('/cliente/')) {
      return undefined;
    }
    // If authenticated admin, go to dashboard
    if (isAuthenticated) {
      return '/';
    }
    // If on login page, go to login
    if (location.pathname === '/login') {
      return undefined;
    }
    // Default to dashboard
    return '/';
  };

  const href = getLinkHref();
  
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
  };

  const logoContent = (
    <div className={`flex items-center gap-3 ${className}`}>
      <img 
        src="https://claudiogonzalez.dev/assets/images/logo.svg"
        alt="Logo"
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {showText && (
        <span className="font-bold text-white text-sm sm:text-base whitespace-nowrap">
          Claudio González
        </span>
      )}
    </div>
  );

  // If in public portal (cliente), don't make it a link
  if (!href) {
    return <div className="cursor-default">{logoContent}</div>;
  }

  return (
    <Link to={href} title="Ir al dashboard">
      {logoContent}
    </Link>
  );
}
