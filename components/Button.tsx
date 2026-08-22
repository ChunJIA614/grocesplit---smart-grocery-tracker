import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyle = "min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  const variants = {
    primary: "bg-[#0a84ff] hover:bg-[#0077ed] text-white border-[#0a84ff] shadow-sm shadow-blue-500/20",
    secondary: "bg-white hover:bg-gray-50 text-gray-800 border-gray-200 shadow-sm",
    danger: "bg-[#ff3b30] hover:bg-[#e8342b] text-white border-[#ff3b30] shadow-sm shadow-red-500/20",
    success: "bg-[#30b06a] hover:bg-[#28995b] text-white border-[#30b06a] shadow-sm shadow-emerald-500/20",
    ghost: "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-black/[0.04] border-transparent"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};
