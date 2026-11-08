"use client";
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

// Digits only, with country code, e.g. 919876543210. Set NEXT_PUBLIC_WHATSAPP_NUMBER in web/.env.local.
const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

/**
 * Floating WhatsApp button (bottom right). Opens a small chat-style popup; "Start chat" opens WhatsApp.
 * Later this popup can host the chatbot: replace the body of the panel and keep the button.
 */
export default function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Hi Sulthan Holidays, I would like to know about Wayanad packages.");

  const link = `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="glass-strong w-72 overflow-hidden" role="dialog" aria-label="Chat on WhatsApp">
          <div className="flex items-center justify-between bg-[#25D366] px-4 py-3 text-white">
            <div>
              <p className="font-bold">Sulthan Holidays</p>
              <p className="text-xs opacity-90">Usually replies within a few hours</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-1 hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <p className="rounded-xl rounded-tl-sm bg-leaf-100 p-3 text-sm">
              Hello! Ask us about packages, vehicles or prices. We will reply on WhatsApp.
            </p>
            <textarea className="field text-sm" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
            {NUMBER ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#25D366] text-white hover:brightness-95">
                Start chat on WhatsApp
              </a>
            ) : (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                WhatsApp number not set yet. Add NEXT_PUBLIC_WHATSAPP_NUMBER to web/.env.local.
              </p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Chat with us on WhatsApp"
        aria-expanded={open}
        className="grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 transition hover:scale-105"
      >
        <MessageCircle size={28} fill="currentColor" />
      </button>
    </div>
  );
}
