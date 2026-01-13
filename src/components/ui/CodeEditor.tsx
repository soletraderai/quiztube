import { useState, useRef, useEffect } from 'react';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (code: string) => void;
  onRun?: (code: string) => void;
  className?: string;
  allowFullscreen?: boolean;
}

// Simple syntax highlighting patterns
const highlightCode = (code: string, language: string): string => {
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Keywords for different languages
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'public', 'private', 'protected'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'String', 'boolean', 'return', 'if', 'else', 'for', 'while', 'new', 'this', 'super', 'try', 'catch', 'throw', 'throws'],
    default: ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'this'],
  };

  const langKeywords = keywords[language] || keywords.default;

  // Highlight strings (both single and double quotes)
  highlighted = highlighted.replace(
    /(["'`])(?:(?=(\\?))\2.)*?\1/g,
    '<span class="text-green-600">$&</span>'
  );

  // Highlight comments
  highlighted = highlighted.replace(
    /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
    '<span class="text-gray-500 italic">$&</span>'
  );

  // Highlight numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-orange-500">$1</span>'
  );

  // Highlight keywords
  langKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(
      regex,
      '<span class="text-purple-600 font-semibold">$1</span>'
    );
  });

  // Highlight function calls
  highlighted = highlighted.replace(
    /\b([a-zA-Z_]\w*)\s*\(/g,
    '<span class="text-blue-600">$1</span>('
  );

  return highlighted;
};

// Detect language from code content
const detectLanguage = (code: string): string => {
  if (code.includes('def ') || code.includes('import ') && !code.includes('from ')) return 'python';
  if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
  if (code.includes('public class') || code.includes('void ')) return 'java';
  if (code.includes('function') || code.includes('const ') || code.includes('let ')) return 'javascript';
  return 'javascript';
};

export default function CodeEditor({
  initialCode = '',
  language,
  readOnly = false,
  onChange,
  onRun,
  className = '',
  allowFullscreen = true,
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [detectedLang, setDetectedLang] = useState(language || 'javascript');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when fullscreen
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!language) {
      setDetectedLang(detectLanguage(code));
    }
  }, [code, language]);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange?.(newCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      onChange?.(newCode);
      // Set cursor position after tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }

    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onRun) {
      e.preventDefault();
      onRun(code);
    }
  };

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const lineNumbers = code.split('\n').map((_, i) => i + 1);

  const availableLanguages = ['javascript', 'typescript', 'python', 'java', 'html', 'css'];

  const handleLanguageChange = (newLang: string) => {
    setDetectedLang(newLang);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      ref={containerRef}
      className={`border-3 border-border bg-gray-900 text-white ${className} ${
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col'
          : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b-2 border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          {readOnly ? (
            <span className="text-xs text-gray-400 font-mono uppercase ml-2">{detectedLang}</span>
          ) : (
            <select
              value={detectedLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="text-xs bg-gray-700 text-gray-300 font-mono uppercase ml-2 px-2 py-1 border border-gray-600 rounded cursor-pointer hover:bg-gray-600"
              title="Select language"
            >
              {availableLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRun && (
            <button
              onClick={() => onRun(code)}
              className="px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white border-2 border-black transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            title="Copy code"
          >
            {showCopied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          {allowFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen (ESC)' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className={`relative flex font-mono text-sm ${isFullscreen ? 'flex-1 overflow-hidden' : ''}`}>
        {/* Line numbers */}
        <div className={`flex-shrink-0 w-12 bg-gray-800 text-gray-500 text-right py-3 pr-3 select-none border-r border-gray-700 ${isFullscreen ? 'overflow-auto' : ''}`}>
          {lineNumbers.map(num => (
            <div key={num} className="leading-6">{num}</div>
          ))}
        </div>

        {/* Code area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Syntax highlighted background */}
          <pre
            ref={preRef}
            className="absolute inset-0 p-3 m-0 overflow-auto pointer-events-none leading-6 whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: highlightCode(code, detectedLang) + '\n' }}
          />

          {/* Invisible textarea for input */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            readOnly={readOnly}
            className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-white resize-none outline-none leading-6 whitespace-pre-wrap break-words"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            style={{ minHeight: isFullscreen ? '100%' : '200px' }}
          />
        </div>
      </div>

      {/* Fullscreen hint */}
      {isFullscreen && (
        <div className="px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 text-center">
          Press ESC or click the X to exit fullscreen
        </div>
      )}
    </div>
  );
}
