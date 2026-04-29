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
    <div className="flex flex-col h-full bg-[#171614] rounded-sm border border-[#3D3B37] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3D3B37]">
        <div className="w-8 h-8 rounded-sm bg-[#DA7756]/20 border border-[#DA7756]/40 flex items-center justify-center text-[#DA7756] font-mono text-sm font-semibold">
          M
        </div>
        <div>
          <h3 className="font-mono text-sm font-medium text-[#F5F0E8]">Cadence</h3>
          <p className="font-mono text-[10px] text-[#9B9590] uppercase tracking-wider">intelligence layer</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-[#DA7756] opacity-75" />
            <span className="relative rounded-full h-2.5 w-2.5 bg-[#DA7756]" />
          </span>
          <span className="text-xs text-[#DA7756] font-mono font-medium">LIVE</span>
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
      <div className="p-4 border-t border-[#3D3B37]">
        <div className="flex items-center gap-2 bg-[#0D0C0B] rounded-sm px-4 py-2 border border-[#3D3B37] focus-within:border-[#DA7756]/50 focus-within:shadow-[0_0_12px_rgba(218,119,86,0.08)] transition-all">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="query > "
            className="flex-1 bg-transparent font-mono text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none"
            disabled={state !== 'idle'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state !== 'idle'}
            className="text-[#DA7756] hover:text-[#DA7756]/80 disabled:text-[#6B6560] transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
