import { useEffect, useRef, useState } from "react";

/**
 * BackButtonHandler - Handles Android/iOS back button with double-click to exit
 * 
 * Features:
 * - Syncs with phone's back button
 * - Shows "Double click to exit" message on last page
 * - Navigates back through browser history
 * 
 * Note: This component works without React Router - uses browser history directly
 */
export default function BackButtonHandler({ currentPage, onNavigateBack }) {
  const lastPressRef = useRef(0);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const exitTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  useEffect(() => {
    // Push a state to history so we can detect back button
    window.history.pushState({ page: currentPage }, '', window.location.href);

    const handlePopState = () => {
      // Check if we're at the root/home page
      const isAtRoot = currentPage === 'dashboard' || currentPage === 'pos';
      
      if (isAtRoot) {
        // Check if user already pressed back recently (within 2 seconds)
        const now = Date.now();
        if (now - lastPressRef.current < 2000) {
          // Second press - try to exit
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
              // Can't exit, stay on page
              window.history.pushState({ page: currentPage }, '', window.location.href);
              setShowExitWarning(true);
              warningTimeoutRef.current = setTimeout(() => {
                setShowExitWarning(false);
              }, 2000);
              return;
            }
            window.history.back();
          }
          return;
        }
        
        // First press - show warning and push state back
        lastPressRef.current = now;
        setShowExitWarning(true);
        window.history.pushState({ page: currentPage }, '', window.location.href);
        
        // Auto-hide warning after 2 seconds
        warningTimeoutRef.current = setTimeout(() => {
          setShowExitWarning(false);
        }, 2000);
        
        return;
      }
      
      // Not at root - navigate back
      if (onNavigateBack) {
        onNavigateBack();
      } else {
        window.history.back();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [currentPage, onNavigateBack]);

  // Render the exit warning if showing
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
      whiteSpace: 'nowrap',
    }}>
      Press back again to exit
    </div>
  ) : null;
}