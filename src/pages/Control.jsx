import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowUp, Sparkles } from 'lucide-react';
import ChatMessage from '../components/ai/ChatMessage';
import TypingIndicator from '../components/ai/TypingIndicator';
import { useChat } from '../hooks/useChat';

export default function Control() {
  const navigate = useNavigate();
  const { messages, state, suggestions, sendMessage, pendingAction, clearAction } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const hasConversation = messages.length > 1;
  const welcome = messages[0];

  useEffect(() => {
    if (hasConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, state, hasConversation]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pendingAction?.type === 'navigate') {
      clearAction();
      navigate(pendingAction.url);
    }
  }, [pendingAction, clearAction, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || state !== 'idle') return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleSuggestion = (text) => {
    if (state !== 'idle') return;
    sendMessage(text);
  };

  return (
    <div className="-mx-6 lg:-mx-10 -mt-6 -mb-10 h-[calc(100vh-3.5rem)] flex flex-col">
      {!hasConversation ? (
        /* Centered welcome + input */
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-3xl px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
                  <Sparkles size={18} className="text-[#DA7756]" />
                </div>
              </div>
              <h1 className="font-['Epilogue'] text-3xl font-light text-[#F5F0E8] mb-3">
                What would you like to know?
              </h1>
              <p className="text-sm text-[#9B9590] max-w-lg leading-relaxed">
                {welcome.text}
              </p>

              {suggestions.length > 0 && (
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {suggestions.slice(0, 6).map((text, i) => (
                    <motion.button
                      key={text}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                      onClick={() => handleSuggestion(text)}
                      className="text-left text-xs text-[#9B9590] border border-[#2C2B28] rounded px-4 py-3 hover:border-[#DA7756]/30 hover:text-[#F5F0E8] hover:bg-[#171614] transition-colors cursor-pointer"
                    >
                      {text}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Input inline */}
              <div className="w-full max-w-2xl mt-8">
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center gap-3 bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/40 rounded px-4 py-2.5 transition-colors"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Cadence anything..."
                    disabled={state !== 'idle'}
                    className="flex-1 bg-transparent text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || state !== 'idle'}
                    className="w-8 h-8 rounded bg-[#DA7756] disabled:bg-[#2C2B28] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowUp size={14} className="text-[#0D0C0B]" />
                  </button>
                </form>
                <p className="text-[10px] text-[#6B6560] text-center mt-2">
                  Cadence may produce inaccurate information. Verify critical details.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        /* Conversation mode: messages + bottom input */
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
              <div className="space-y-1">
                {messages.map((msg, i) => {
                  if (msg.isStreaming && !msg.text) return null;
                  return <ChatMessage key={i} message={msg} />;
                })}
                {state === 'streaming' && !messages[messages.length - 1]?.text && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Suggestions during conversation */}
          {state === 'idle' && suggestions.length > 0 && (
            <div className="border-t border-[#2C2B28] bg-[#0D0C0B]/60">
              <div className="max-w-3xl mx-auto px-6 lg:px-10 py-2 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((text) => (
                  <button
                    key={text}
                    onClick={() => handleSuggestion(text)}
                    className="text-[10px] text-[#9B9590] border border-[#2C2B28] rounded-full px-2.5 py-1 hover:border-[#DA7756]/30 hover:text-[#F5F0E8] transition-colors cursor-pointer"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#2C2B28] bg-[#0D0C0B]">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-4">
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-3 bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/40 rounded px-4 py-2.5 transition-colors"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Cadence anything..."
                  disabled={state !== 'idle'}
                  className="flex-1 bg-transparent text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || state !== 'idle'}
                  className="w-8 h-8 rounded bg-[#DA7756] disabled:bg-[#2C2B28] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ArrowUp size={14} className="text-[#0D0C0B]" />
                </button>
              </form>
              <p className="text-[10px] text-[#6B6560] text-center mt-2">
                Cadence may produce inaccurate information. Verify critical details.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
