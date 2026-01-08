import { useState, useRef, useEffect } from 'react';
import Button from './Button';
import type { Topic, ChatMessage } from '../../types';
import { digDeeper, generateAlternateQuestion } from '../../services/gemini';

interface DigDeeperModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic;
  apiKey: string;
  conversation: ChatMessage[];
  onConversationUpdate: (messages: ChatMessage[]) => void;
  onGenerateQuestion: (question: string) => void;
}

export default function DigDeeperModal({
  isOpen,
  onClose,
  topic,
  apiKey,
  conversation,
  onConversationUpdate,
  onGenerateQuestion,
}: DigDeeperModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingQuestion, setGeneratingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const updatedConversation = [...conversation, userMessage];
    onConversationUpdate(updatedConversation);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await digDeeper(apiKey, topic, conversation, input.trim());

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      onConversationUpdate([...updatedConversation, assistantMessage]);
    } catch (err) {
      console.error('Dig deeper error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.');
      // Provide fallback response when API fails
      const fallbackMessage: ChatMessage = {
        role: 'assistant',
        content: `I understand you're curious about "${topic.title}". While I'm having trouble connecting right now, here are some suggestions: Try reviewing the topic summary, exploring related resources, or formulating your question differently. Feel free to ask again!`,
        timestamp: Date.now(),
      };
      onConversationUpdate([...updatedConversation, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Handle generating more questions
  const handleGenerateMoreQuestions = async () => {
    if (generatingQuestion) return;

    setGeneratingQuestion(true);
    setError(null);

    try {
      const currentQuestion = topic.questions[0];
      const newQuestion = await generateAlternateQuestion(
        apiKey,
        topic,
        currentQuestion,
        'harder'
      );
      onGenerateQuestion(newQuestion);
    } catch (err) {
      console.error('Generate question error:', err);
      setError('Failed to generate new question. Please try again.');
    } finally {
      setGeneratingQuestion(false);
    }
  };

  // Handle key press (Enter to send)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dig-deeper-title"
    >
      <div className="bg-surface border-3 border-border shadow-brutal w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-3 border-border bg-secondary/10">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="dig-deeper-title"
                className="font-heading text-xl font-bold text-text"
              >
                Dig Deeper
              </h2>
              <p className="text-sm text-text/70 mt-1">
                Topic: {topic.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 border-2 border-border hover:bg-border/20 transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Topic Context */}
        <div className="p-4 border-b-3 border-border bg-primary/5">
          <h3 className="font-heading text-sm font-semibold text-text mb-1">
            Topic Summary
          </h3>
          <p className="text-sm text-text/80">{topic.summary}</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[40vh]">
          {conversation.length === 0 ? (
            <div className="text-center text-text/50 py-8">
              <p className="font-heading font-semibold mb-2">Start a conversation!</p>
              <p className="text-sm">
                Ask questions about "{topic.title}" to deepen your understanding.
              </p>
            </div>
          ) : (
            conversation.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 border-2 border-border ${
                    message.role === 'user'
                      ? 'bg-primary text-text'
                      : 'bg-surface text-text'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs text-text/50 mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border-2 border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 py-2 bg-error/10 text-error text-sm">
            {error}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t-3 border-border">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this topic..."
              className="flex-1 p-3 border-3 border-border bg-surface font-body text-text min-h-[60px] max-h-[120px] resize-none focus:outline-none focus:shadow-brutal"
              disabled={loading}
              aria-label="Your question"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="self-end"
            >
              Send
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t-3 border-border bg-surface flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={handleGenerateMoreQuestions}
            loading={generatingQuestion}
            disabled={generatingQuestion}
          >
            Generate More Questions
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Return to Session
          </Button>
        </div>
      </div>
    </div>
  );
}
