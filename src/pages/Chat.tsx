import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Send } from 'lucide-react';
import { sendChatMessage } from '../services/ai';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'system-start', role: 'model', content: "Welcome to Nano Pro Aesthetics. I am your advanced AI concierge. How may I assist you with your styling or booking today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Exclude the system start message from history
      const history = messages.filter(m => m.id !== 'system-start');
      const responseText = await sendChatMessage(history, userMsg);
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: responseText }]);
    } catch (e: any) {
      console.error(e);
      const isPermissionDenied = e?.message?.includes('403') || e?.status === 'PERMISSION_DENIED';
      if (isPermissionDenied) {
         setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "My advanced cognitive engine requires an authenticated API key. Please use the Try-On tool to 'Authenticate API Key' first." }]);
      } else {
         setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "My apologies, I am experiencing a temporary connection issue. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 max-w-4xl mx-auto w-full px-6 py-8">
      <div className="mb-8 text-center border-b border-[color:var(--color-luxury-accent)]/20 pb-8">
         <h2 className="font-serif text-3xl font-bold italic text-[color:var(--color-luxury-rosegold)] tracking-tight">Digital Concierge</h2>
         <p className="text-[9px] uppercase tracking-[0.3em] opacity-40 mt-4">Powered by Gemini Intelligence</p>
      </div>

      <div className="flex-1 overflow-y-auto mb-8 space-y-6 p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-sm p-6 ${msg.role === 'user' ? 'bg-[color:var(--color-luxury-charcoal)] border border-[color:var(--color-luxury-accent)]/10' : 'bg-transparent border border-[color:var(--color-luxury-accent)]/30'}`}>
               <span className="text-[9px] uppercase tracking-[0.3em] opacity-40 mb-2 block">{msg.role === 'user' ? 'Client' : 'Nano Pro System'}</span>
               <div className="font-sans font-light leading-relaxed markdown-body text-sm">
                 <Markdown>{msg.content}</Markdown>
               </div>
            </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="max-w-[80%] rounded-sm p-6 bg-transparent border border-[color:var(--color-luxury-accent)]/30">
               <span className="text-[9px] uppercase tracking-[0.3em] opacity-40 block mb-2">Processing Response...</span>
               <div className="flex gap-2 mt-2">
                 <div className="w-1 h-1 rounded-full bg-[color:var(--color-luxury-accent)] animate-bounce" />
                 <div className="w-1 h-1 rounded-full bg-[color:var(--color-luxury-accent)] animate-bounce" style={{ animationDelay: '0.1s' }} />
                 <div className="w-1 h-1 rounded-full bg-[color:var(--color-luxury-accent)] animate-bounce" style={{ animationDelay: '0.2s' }} />
               </div>
             </div>
           </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="relative mt-4">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Input inquiry..."
          className="w-full bg-[color:var(--color-luxury-charcoal)] border border-[color:var(--color-luxury-accent)]/20 rounded-sm py-4 pl-6 pr-16 focus:outline-none focus:border-[color:var(--color-luxury-accent)] transition-colors text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-pearl)]"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="absolute right-2 top-2 bottom-2 aspect-square bg-[color:var(--color-luxury-accent)] rounded-sm flex items-center justify-center text-black hover:bg-white transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
