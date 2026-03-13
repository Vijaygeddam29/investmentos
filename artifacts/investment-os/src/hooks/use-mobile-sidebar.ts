import { useState, useCallback, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useMobileSidebar() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isMobile) setOpen(false);
  }, [isMobile]);

  const toggle = useCallback(() => setOpen(p => !p), []);
  const close = useCallback(() => setOpen(false), []);

  return { open, isMobile, toggle, close };
}
