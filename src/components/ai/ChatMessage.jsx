import { memo } from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end px-4 py-2"
      >
        <div className="max-w-[80%] bg-[#00D4FF]/8 border border-[#00D4FF]/20 rounded px-4 py-3 text-sm text-[#F4F0EA]">
          {message.text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 px-4 py-2"
    >
      <div className="w-6 h-6 rounded bg-[#00D4FF]/20 flex items-center justify-center text-[#00D4FF] font-mono text-[10px] font-bold shrink-0 mt-1">
        M
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className={`border-l-2 border-[#00D4FF]/40 pl-4 py-2 text-sm leading-relaxed ${message.isError ? 'text-[#e85d5d]' : 'text-[#F4F0EA]'}`}>
          <div className="prose-chat">
            {message.isStreaming ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.text}<span className="inline-block w-0.5 h-4 bg-[#00D4FF] ml-0.5 align-middle animate-pulse" /></span>
            ) : (
              <Markdown>{message.text}</Markdown>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(ChatMessage, (prev, next) => {
  return prev.message.text === next.message.text
    && prev.message.isStreaming === next.message.isStreaming;
});
