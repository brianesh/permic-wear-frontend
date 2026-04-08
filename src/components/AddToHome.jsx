import { useState, useEffect, useRef } from "react";

function getPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIOS     = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isSafari  = /safari/.test(ua) && !/chrome|crios|fxios|chromium/.test(ua);
  const isSamsungBrowser = /samsungbrowser/.test(ua);
  const isFirefox = /firefox|fxios/.test(ua);
  const isOpera   = /opr\/|opera/.test(ua);
  const isEdge    = /edg\//.test(ua);
  const isBrave   = typeof navigator.brave !== "undefined";
  const isChrome  = /chrome|crios|chromium/.test(ua) && !isEdge && !isOpera && !isSamsungBrowser;
  const isMobile  = isIOS || isAndroid;
  const isDesktop = !isMobile;
  const isMacOS   = /macintosh/.test(ua) && !isIOS;
  return {
    isStandalone, isIOS, isAndroid, isSafari, isSamsungBrowser,
    isFirefox, isOpera, isEdge, isBrave, isChrome,
    isMobile, isDesktop, isMacOS,
  };
}

function getInstructions(p) {
  if (p.isIOS && p.isSafari) return {
    title: "Add to Home Screen (iOS Safari)",
    steps: [
      { icon: "1.", t: "Tap the Share button", s: "the square-with-arrow icon at the bottom of Safari" },
      { icon: "2.", t: "Tap 'Add to Home Screen'", s: "scroll down in the share sheet if needed" },
      { icon: "3.", t: "Tap Add", s: "the app icon will appear on your home screen" },
    ],
  };
  if (p.isMacOS && p.isSafari) return {
    title: "Add to Dock (Safari macOS)",
    steps: [
      { icon: "1.", t: "Click File in the menu bar", s: "" },
      { icon: "2.", t: "Click 'Add to Dock...'", s: "" },
      { icon: "3.", t: "Click Add", s: "the app appears in your macOS Dock" },
    ],
  };
  if (p.isBrave && p.isDesktop) return {
    title: "Install on Brave (Desktop)",
    steps: [
      { icon: "1.", t: "Click the menu icon top-right", s: "the three lines or dots" },
      { icon: "2.", t: "Look for 'Install Permic Mens Wear...'", s: "or go to More tools > Create shortcut" },
      { icon: "3.", t: "Tick 'Open as window' then click Create", s: "" },
    ],
  };
  if (p.isFirefox && p.isAndroid) return {
    title: "Install on Firefox (Android)",
    steps: [
      { icon: "1.", t: "Tap the three-dot menu top-right", s: "" },
      { icon: "2.", t: "Tap 'Install' or 'Add to Home Screen'", s: "" },
      { icon: "3.", t: "Tap Add", s: "" },
    ],
  };
  if (p.isFirefox && p.isDesktop) return {
    title: "Firefox Desktop",
    steps: [
      { icon: "i", t: "Firefox desktop does not support PWA install", s: "Use Chrome, Edge, or Brave for the best experience" },
      { icon: "*", t: "Or bookmark this page", s: "Ctrl+D (Windows) or Cmd+D (Mac)" },
    ],
  };
  if (p.isOpera) return {
    title: "Install on Opera",
    steps: [
      { icon: "1.", t: "Click the Opera menu top-left", s: "" },
      { icon: "2.", t: "Click 'Install Permic Mens Wear...'", s: "" },
      { icon: "3.", t: "Click Install", s: "" },
    ],
  };
  if (p.isAndroid) return {
    title: "Add to Home Screen",
    steps: [
      { icon: "1.", t: "Tap the three-dot menu in your browser", s: "" },
      { icon: "2.", t: "Tap 'Add to Home screen' or 'Install app'", s: "" },
      { icon: "3.", t: "Tap Add", s: "" },
    ],
  };
  return {
    title: "Install App",
    steps: [
      { icon: "1.", t: "Click the install icon in the address bar", s: "or open the browser menu" },
      { icon: "2.", t: "Click Install or Add to desktop", s: "" },
      { icon: "3.", t: "Click Install", s: "the app opens in its own window" },
    ],
  };
}

export default function AddToHome() {
  const [show, setShow]           = useState(false);
  const [platform, setPlatform]   = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const deferredPrompt            = useRef(null);

  useEffect(() => {
    const p = getPlatform();
    setPlatform(p);
    if (p.isStandalone) return;

    const supportsNativePrompt =
      p.isChrome || p.isEdge || p.isSamsungBrowser || p.isOpera || (p.isBrave && p.isAndroid);

    if (supportsNativePrompt) {
      const handler = (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Save the event for later - we'll use it to show the install prompt
        deferredPrompt.current = e;
        // Show our custom install banner
        setShow(true);
        console.log('[PWA] beforeinstallprompt captured, banner will show');
      };
      window.addEventListener("beforeinstallprompt", handler);
      
      // Fallback: if the event hasn't fired after 3 seconds, still show the banner
      // but without native install support
      const t = setTimeout(() => {
        if (!deferredPrompt.current) {
          console.log('[PWA] beforeinstallprompt not fired, showing manual install banner');
          setShow(true);
        }
      }, 3000);
      
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(t);
      };
    }

    // For browsers that don't support beforeinstallprompt (iOS, Firefox, etc.)
    // show the manual install instructions banner
    const t = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => setShow(false);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") { setShow(false); return; }
    }
    setShowSteps(true);
  };

  if (!show || !platform) return null;

  const instructions = getInstructions(platform);
  const hasNative    = !!deferredPrompt.current;

  const alwaysShowSteps =
    (platform.isIOS && platform.isSafari) ||
    platform.isFirefox ||
    (platform.isMacOS && platform.isSafari);

  if (showSteps || alwaysShowSteps) {
    return (
      <div style={wrapStyle}>
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>Install App</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>{instructions.title}</div>
          {instructions.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)", flexShrink: 0, minWidth: 16 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.t}</div>
                {s.s ? <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{s.s}</div> : null}
              </div>
            </div>
          ))}
          <button style={{ ...btnStyle, marginTop: 14 }} onClick={() => setShow(false)}>
            Got it
          </button>
        </div>
        <button style={closeStyle} onClick={() => setShow(false)}>x</button>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={titleStyle}>Install Permic Mens Wear</div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
          Quick access - works offline too
        </div>
      </div>
      <button style={btnStyle} onClick={handleInstall}>
        {hasNative ? "Install Now" : "How to Install"}
      </button>
      <button style={closeStyle} onClick={() => setShow(false)}>x</button>
    </div>
  );
}

const wrapStyle = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
  background: "var(--bg2)",
  border: "1.5px solid var(--teal)",
  borderRadius: 14,
  padding: "14px 16px",
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  maxWidth: 400,
  width: "calc(100% - 32px)",
};

const titleStyle = {
  fontWeight: 700,
  fontSize: 13,
  color: "var(--text)",
};

const btnStyle = {
  background: "var(--teal)",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const closeStyle = {
  background: "none",
  border: "none",
  color: "var(--text3)",
  fontSize: 18,
  cursor: "pointer",
  padding: "0 2px",
  flexShrink: 0,
  lineHeight: 1,
  alignSelf: "flex-start",
};
