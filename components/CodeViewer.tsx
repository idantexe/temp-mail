
import React, { useState } from 'react';

interface CodeViewerProps {
  code: string;
}

const CopyIcon: React.FC<{ copied: boolean }> = ({ copied }) => copied ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);


export const CodeViewer: React.FC<CodeViewerProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative bg-base-300 rounded-lg">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-base-100/50 hover:bg-base-100 transition-colors text-slate-300 hover:text-white"
        aria-label="Copy code"
      >
        <CopyIcon copied={copied} />
      </button>
      <pre className="p-4 text-sm text-slate-300 overflow-auto max-h-60 rounded-lg">
        <code>{code}</code>
      </pre>
    </div>
  );
};
   