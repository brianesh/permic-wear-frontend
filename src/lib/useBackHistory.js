/**
 * useBackHistory.js — Phone back button syncs with app navigation
 *
 * Provides two hooks:
 *
 * 1. useBackHistory(activePage, setPage, startPage)
 *    - Pushes navigation state into browser history
 *    - On browser back button, pops the stack and calls setPage
 *    - Syncs phone hardware back button with in-app navigation
 *    - If at root page, shows "double click to exit" message on second back press
 *
 * 2. useModalBackButton(isOpen, onClose)
 *    - When a modal/overlay is open, intercepts back button to close it
 *    - Prevents navigating away while a modal is active
 *
 * Usage:
 *   const { pushHistory } = useBackHistory(activePage, setPage, 'dashboard');
 *   const navigate = page => { setPage(page); pushHistory(page); };
 *
 *   useModalBackButton(isModalOpen, () => setIsModalOpen(false));
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const HISTORY_KEY = 'permic_nav_history';
const EXIT_WARNING_KEY = 'permic_exit_warning';
const EXIT_WARNING_TIMEOUT = 2000; // 2 seconds to press back again

/**
 * useBackHistory — manages browser history stack for SPA navigation
 * Returns { pushHistory, showExitWarning } where showExitWarning is a boolean
 * indicating if the "double click to exit" message should be shown
 */
export function useBackHistory(activePage, setPage, startPage) {
  const initialized = useRef(false);
  const exitWarningTimeout = useRef(null);
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Initialize: restore history from sessionStorage on first load
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const saved = sessionStorage.getItem(HISTORY_KEY);
      const history = saved ? JSON.parse(saved) : [];
      // If no history exists, seed it with the start page
      if (history.length === 0) {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify([startPage]));
      }
    } catch (_) {}
  }, [startPage]);

  // Push a new page onto the history stack
  const pushHistory = useCallback((page) => {
    try {
      const saved = sessionStorage.getItem(HISTORY_KEY);
      const history = saved ? JSON.parse(saved) : [];
      // Don't push duplicates of the current page
      if (history[history.length - 1] === page) return;
      history.push(page);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      // Push a real browser history entry so the phone back button fires popstate
      window.history.pushState({ page, permic: true }, '', window.location.pathname);
      // Clear exit warning when navigating to a new page
      sessionStorage.removeItem(EXIT_WARNING_KEY);
      setShowExitWarning(false);
      if (exitWarningTimeout.current) {
        clearTimeout(exitWarningTimeout.current);
        exitWarningTimeout.current = null;
      }
    } catch (_) {}
  }, []);

  // Handle browser back button
  useEffect(() => {
    const onPopState = (event) => {
      // Only handle our own navigation states
      if (!event.state?.permic && event.state !== null && event.state?.page === undefined) {
        return; // Not our state — let browser handle it
      }
      try {
        const saved = sessionStorage.getItem(HISTORY_KEY);
        const history = saved ? JSON.parse(saved) : [];

        if (history.length > 1) {
          // Pop current page and go to previous
          history.pop();
          const prevPage = history[history.length - 1] || startPage;
          sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
          // Push a replacement state so we can detect next back press
          window.history.pushState({ page: prevPage, permic: true }, '', window.location.pathname);
          // Clear exit warning
          sessionStorage.removeItem(EXIT_WARNING_KEY);
          setShowExitWarning(false);
          if (exitWarningTimeout.current) {
            clearTimeout(exitWarningTimeout.current);
            exitWarningTimeout.current = null;
          }
          setPage(prevPage);
        } else {
          // At root page — double-press to exit
          const warningShown = sessionStorage.getItem(EXIT_WARNING_KEY);
          if (warningShown) {
            sessionStorage.removeItem(EXIT_WARNING_KEY);
            setShowExitWarning(false);
            // Exit: navigate to a blank state so next back closes the app
            window.history.go(-window.history.length);
          } else {
            sessionStorage.setItem(EXIT_WARNING_KEY, 'true');
            setShowExitWarning(true);
            // Push state again so we can catch the next back press
            window.history.pushState({ page: startPage, permic: true, exit: true }, '', window.location.pathname);
            exitWarningTimeout.current = setTimeout(() => {
              sessionStorage.removeItem(EXIT_WARNING_KEY);
              setShowExitWarning(false);
              exitWarningTimeout.current = null;
            }, EXIT_WARNING_TIMEOUT);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (exitWarningTimeout.current) {
        clearTimeout(exitWarningTimeout.current);
      }
    };
  }, [setPage, startPage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (exitWarningTimeout.current) {
        clearTimeout(exitWarningTimeout.current);
      }
    };
  }, []);

  return { pushHistory, showExitWarning };
}

/**
 * useModalBackButton — intercepts back button when modal is open
 *
 * When isOpen is true, pressing the back button will call onClose
 * instead of navigating away. This is used for modals, overlays,
 * and full-screen dialogs.
 */
export function useModalBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy history entry so back button triggers popstate
    const dummyState = { modal: true, timestamp: Date.now() };
    window.history.pushState(dummyState, '');

    const onPopState = () => {
      if (onCloseRef.current) onCloseRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isOpen]);
}