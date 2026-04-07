import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * BackButtonHandler - Handles Android/iOS back button with double-click to exit
 * 
 * Features:
 * - Syncs with phone's back button
 * - Shows "Double click to exit" message on last page
 * - Navigates back through app history
 */
export default function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastPressRef = useRef(0);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const exitTimeoutRef = useRef(null);

  useEffect(() => {
    // Handle Android/iOS back button
    const handleBackButton = (e) => {
      // Check if we're at the root/home page
      const isAtRoot = location.pathname === '/' || location.pathname === '/dashboard';
      
      if (isAtRoot) {
        // Check if user already pressed back recently (within 2 seconds)
        const now = Date.now();
        if (now - lastPressRef.current < 2000) {
          // Second press - exit app
          if (exitTimeoutRef.current) {
            clearTimeout(exitTimeoutRef.current);
          }
          
          // Try to close the window (works in some browsers/PWA)
          if (window.navigator.app?.exitApp) {
            window.navigator.app.exitApp();
          } else {
            // For web browsers, try to go back in history
            // If no history, show warning
            if (window.history.length <= 1) {
              // Can't exit, show warning
              setShowExitWarning(true);
              exitTimeoutRef.current = setTimeout(() => {
                setShowExitWarning(false);
              }, 2000);
              return;
            }
            window.history.back();
          }
          return;
        }
        
        // First press - show warning
        lastPressRef.current = now;
        setShowExitWarning(true);
        
        // Auto-hide warning after 2 seconds
        exitTimeoutRef.current = setTimeout(() => {
          setShowExitWarning(false);
        }, 2000);
        
        // Prevent default back behavior
        if (e.preventDefault) e.preventDefault();
        return;
      }
      
      // Not at root - navigate back normally
      navigate(-1);
      if (e.preventDefault) e.preventDefault();
    };

    // Add event listener for Android/iOS back button
    window.addEventListener('popstate', handleBackButton);
    
    // Also listen for hardware back button (Android)
    document.addEventListener('backbutton', handleBackButton, false);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
      document.removeEventListener('backbutton', handleBackButton);
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [navigate, location.pathname]);

  // Don't render anything - this is a handler component
  return showExitWarning ? (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.85)',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 25,
      fontSize: 14,
      fontWeight: 600,
      zIndex: 9999,
      backdropFilter: 'blur(8px)',
      animation: 'slideUp 0.3s ease',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      Press back again to exit
    </div>
  ) : null;
}