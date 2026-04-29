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
        <div className="max-w-[80%] bg-[#DA7756]/8 border border-[#DA7756]/20 rounded px-4 py-3 text-sm text-[#F5F0E8]">
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
      <div className="w-6 h-6 rounded bg-[#DA7756]/20 flex items-center justify-center text-[#DA7756] font-mono text-[10px] font-bold shrink-0 mt-1">
        M
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className={`border-l-2 border-[#DA7756]/40 pl-4 py-2 text-sm leading-relaxed ${message.isError ? 'text-[#C75F4F]' : 'text-[#F5F0E8]'}`}>
          <div className="prose-chat">
            {message.isStreaming ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.text}<span className="inline-block w-0.5 h-4 bg-[#DA7756] ml-0.5 align-middle animate-pulse" /></span>
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
