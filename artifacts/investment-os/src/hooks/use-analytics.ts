import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getSessionId(): string {
  let id = sessionStorage.getItem("_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_sid", id);
  }
  return id;
}

async function sendEvent(payload: {
  sessionId: string;
  userId?: number;
  eventType: string;
  page: string;
  referrer?: string;
  durationMs?: number;
  properties?: Record<string, unknown>;
}) {
  try {
    await fetch(`${BASE}/api/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // silently drop — analytics should never break the app
  }
}

export function useAnalytics() {
  const [location] = useLocation();
  const { user } = useAuth();
  const enteredAt = useRef<number>(Date.now());
  const prevPage = useRef<string>("");

  useEffect(() => {
    const sessionId = getSessionId();
    const page = location || "/";

    // Fire page_leave for the previous page with time spent
    if (prevPage.current && prevPage.current !== page) {
      const durationMs = Date.now() - enteredAt.current;
      sendEvent({
        sessionId,
        userId: (user as any)?.id,
        eventType: "page_leave",
        page: prevPage.current,
        durationMs,
      });
    }

    // Fire page_view for the new page
    sendEvent({
      sessionId,
      userId: (user as any)?.id,
      eventType: "page_view",
      page,
      referrer: prevPage.current || document.referrer || undefined,
    });

    prevPage.current = page;
    enteredAt.current = Date.now();
  }, [location, user]);

  // Fire page_leave on tab close / navigation away
  useEffect(() => {
    const sessionId = getSessionId();

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        const durationMs = Date.now() - enteredAt.current;
        sendEvent({
          sessionId,
          userId: (user as any)?.id,
          eventType: "page_leave",
          page: prevPage.current || location,
          durationMs,
        });
      } else {
        enteredAt.current = Date.now();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user, location]);
}

export function trackClick(feature: string, properties?: Record<string, unknown>) {
  const sessionId = getSessionId();
  sendEvent({
    sessionId,
    eventType: "feature_click",
    page: window.location.pathname,
    properties: { feature, ...properties },
  });
}
