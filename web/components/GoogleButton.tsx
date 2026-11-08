"use client";
import { useEffect, useRef } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** "Continue with Google". Hidden when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. */
export default function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => cb.current(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", shape: "pill", width: 300 });
    };
    if (window.google) return render();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, []);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center" />;
}
