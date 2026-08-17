import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, X, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

const WELCOME = "Hi, I'm Buddy! Ask me about benefits, events, your requests, or how the portal works.";

const SpeechRecognitionAPI = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const speechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenRef = useRef(0);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!speakEnabled || !speechSynthesisSupported) return;
    for (let i = lastSpokenRef.current; i < messages.length; i++) {
      if (messages[i].role === "assistant") {
        const utterance = new SpeechSynthesisUtterance(messages[i].text);
        window.speechSynthesis.speak(utterance);
      }
    }
    lastSpokenRef.current = messages.length;
  }, [messages, speakEnabled]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (speechSynthesisSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const toggleSpeak = () => {
    setSpeakEnabled(prev => {
      if (prev && speechSynthesisSupported) window.speechSynthesis.cancel();
      return !prev;
    });
  };

  const toggleListening = () => {
    if (!SpeechRecognitionAPI) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages.slice(1);
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.map(m => ({ role: m.role, text: m.text })) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages(prev => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: err instanceof Error ? err.message : "Something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return <>
      <div className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-40 group">
        <span
          role="tooltip"
          className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground text-background text-xs font-medium px-2.5 py-1.5 shadow-md transition-opacity duration-150 pointer-events-none ${open ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}
        >
          Chat with Buddy
        </span>

        <Button
          className={`relative h-12 w-12 rounded-full shadow-lg p-0 overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-110 active:scale-95 ${open ? "td-gradient border-0 text-white" : "bg-white dark:bg-slate-900 border border-border"}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Buddy, your AI assistant"
        >
          <span className="relative h-12 w-12 block">
            <img src="/logo.png" alt="" className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${open ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`} />
            <X className={`absolute inset-0 h-5 w-5 m-auto transition-all duration-300 ${open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"}`} />
          </span>
        </Button>
      </div>

      <div
        aria-hidden={!open}
        className={`fixed bottom-36 right-4 sm:bottom-20 sm:right-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] h-[500px] max-h-[70vh] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out origin-bottom-right ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 translate-y-4 pointer-events-none"}`}
      >
          <div className="td-gradient text-white px-4 py-3 flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
            <p className="text-sm font-semibold flex-1">Buddy</p>
            {speechSynthesisSupported && (
              <button
                type="button"
                onClick={toggleSpeak}
                className="p-1 rounded-md hover:bg-white/20 transition-colors"
                aria-label={speakEnabled ? "Turn off spoken replies" : "Turn on spoken replies"}
                aria-pressed={speakEnabled}
                title={speakEnabled ? "Spoken replies on" : "Spoken replies off"}
              >
                {speakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-secondary/20">
            {messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "td-gradient text-white" : "bg-background border border-border text-foreground"}`}>
                  {m.text}
                </div>
              </div>)}
            {sending && <div className="flex justify-start">
                <div className="bg-background border border-border text-muted-foreground rounded-lg px-3 py-2 text-sm">Thinking...</div>
              </div>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-2 flex items-center gap-1.5 bg-background">
            <input
              className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ask Buddy anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {SpeechRecognitionAPI && (
              <Button
                size="sm"
                variant="outline"
                className={`h-9 w-9 p-0 shrink-0 ${listening ? "bg-destructive text-destructive-foreground border-destructive animate-pulse" : ""}`}
                onClick={toggleListening}
                aria-label={listening ? "Stop voice input" : "Speak to Buddy"}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button size="sm" className="h-9 w-9 p-0 shrink-0 td-gradient border-0 text-white" disabled={sending || !input.trim()} onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
    </>;
}
