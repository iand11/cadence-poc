import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatSuggestions from './ChatSuggestions';
import TypingIndicator from './TypingIndicator';
import { useChat } from '../../hooks/useChat';

export default function ChatInterface() {
  const { messages, state, suggestions, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, state]);

  const handleSend = () => {
    if (!input.trim() || state !== 'idle') return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (text) => {
    if (state !== 'idle') return;
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0F0F] rounded-sm border border-[#2A2A2A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2A2A2A]">
        <div className="w-8 h-8 rounded-sm bg-[#00D4FF]/20 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF] font-mono text-sm font-semibold">
          M
        </div>
        <div>
          <h3 className="font-mono text-sm font-medium text-[#F4F0EA]">Cadence</h3>
          <p className="font-mono text-[10px] text-[#888888] uppercase tracking-wider">intelligence layer</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-[#00D4FF] opacity-75" />
            <span className="relative rounded-full h-2.5 w-2.5 bg-[#00D4FF]" />
          </span>
          <span className="text-xs text-[#00D4FF] font-mono font-medium">LIVE</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.map((msg, i) => {
          if (msg.isStreaming && !msg.text) return null;
          return <ChatMessage key={i} message={msg} />;
        })}
        {state === 'streaming' && !messages[messages.length - 1]?.text && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {state === 'idle' && suggestions.length > 0 && (
        <ChatSuggestions suggestions={suggestions} onSelect={handleSuggestionClick} />
      )}

      {/* Input */}
      <div className="p-4 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-2 bg-[#080808] rounded-sm px-4 py-2 border border-[#2A2A2A] focus-within:border-[#00D4FF]/50 focus-within:shadow-[0_0_12px_rgba(232,168,73,0.08)] transition-all">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="query > "
            className="flex-1 bg-transparent font-mono text-sm text-[#F4F0EA] placeholder-[#444444] outline-none"
            disabled={state !== 'idle'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state !== 'idle'}
            className="text-[#00D4FF] hover:text-[#00D4FF]/80 disabled:text-[#444444] transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
