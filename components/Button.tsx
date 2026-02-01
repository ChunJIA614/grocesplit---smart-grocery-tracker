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
  // Bootstrap-like base styles: reduced roundness, specific padding
  const baseStyle = "px-4 py-2 rounded font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-65 disabled:cursor-not-allowed";
  
  const variants = {
    // Bootstrap Primary Blue #0d6efd
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 border border-blue-600",
    // Bootstrap Secondary Gray
    secondary: "bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 border border-gray-600",
    // Bootstrap Danger Red #dc3545
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 border border-red-600",
    // Bootstrap Success Green #198754
    success: "bg-green-700 hover:bg-green-800 text-white focus:ring-green-500 border border-green-700",
    // Ghost/Link
    ghost: "bg-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-transparent"
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