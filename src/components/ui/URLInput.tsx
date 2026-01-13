/**
 * URLInput Component
 * YouTube URL input with real-time validation
 */
import { useState, useEffect, useMemo } from 'react';
import MaterialIcon from './MaterialIcon';
import Button from './Button';

export interface URLInputProps {
  /** Current URL value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Submit handler (valid URL) */
  onSubmit?: (videoId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  // Standard watch URL
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?$/,
  // Shortened youtu.be URL
  /^(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
  // Embedded URL
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
  // YouTube Shorts
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
  // Mobile URL
  /^(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?$/,
];

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Validate if URL is a supported YouTube format
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

export default function URLInput({
  value: controlledValue,
  onChange,
  onSubmit,
  placeholder = 'https://youtube.com/watch?v=...',
  disabled = false,
  loading = false,
  className = '',
  autoFocus = false,
}: URLInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const [touched, setTouched] = useState(false);

  // Use controlled value if provided
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Validation state
  const validationState = useMemo(() => {
    if (!value.trim()) {
      return { isValid: false, error: null, videoId: null };
    }

    const videoId = extractVideoId(value);
    if (videoId) {
      return { isValid: true, error: null, videoId };
    }

    return {
      isValid: false,
      error: 'Please enter a valid YouTube URL',
      videoId: null,
    };
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationState.isValid && validationState.videoId && onSubmit) {
      onSubmit(validationState.videoId);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        if (controlledValue === undefined) {
          setInternalValue(clipboardText);
        }
        onChange?.(clipboardText);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const showError = touched && value.trim() && !validationState.isValid;

  return (
    <form onSubmit={handleSubmit} className={`space-y-2 ${className}`}>
      {/* Input Container */}
      <div className="relative">
        {/* YouTube Icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <MaterialIcon
            name="smart_display"
            size="lg"
            className={validationState.isValid ? 'text-success' : 'text-text/50'}
            decorative
          />
        </div>

        {/* Input */}
        <input
          type="url"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || loading}
          autoFocus={autoFocus}
          className={`w-full py-3 pl-11 pr-24 bg-surface border-3 rounded font-body text-text placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
            showError
              ? 'border-error focus:border-error focus:ring-error'
              : validationState.isValid
              ? 'border-success focus:border-success'
              : 'border-border'
          }`}
          aria-label="YouTube URL"
          aria-invalid={showError}
          aria-describedby={showError ? 'url-error' : 'url-formats'}
        />

        {/* Action Buttons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Paste Button */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={disabled || loading}
            className="p-2 text-text/50 hover:text-text transition-colors disabled:opacity-50"
            aria-label="Paste from clipboard"
          >
            <MaterialIcon name="content_paste" size="md" />
          </button>

          {/* Submit Button */}
          <Button
            type="submit"
            size="sm"
            disabled={disabled || loading || !validationState.isValid}
            className="min-w-[80px]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-text/30 border-t-text rounded-full animate-spin" />
            ) : (
              <>
                <MaterialIcon name="play_arrow" size="sm" className="mr-1" decorative />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {showError && (
        <p id="url-error" className="text-sm text-error flex items-center gap-1">
          <MaterialIcon name="error" size="sm" decorative />
          {validationState.error}
        </p>
      )}

      {/* Supported Formats */}
      {!showError && (
        <div id="url-formats" className="text-xs text-text/50">
          <p className="font-semibold mb-1">Supported formats:</p>
          <ul className="flex flex-wrap gap-2">
            <li className="flex items-center gap-1">
              <MaterialIcon name="check" size="sm" className="text-success" decorative />
              youtube.com/watch?v=...
            </li>
            <li className="flex items-center gap-1">
              <MaterialIcon name="check" size="sm" className="text-success" decorative />
              youtu.be/...
            </li>
            <li className="flex items-center gap-1">
              <MaterialIcon name="check" size="sm" className="text-success" decorative />
              YouTube Shorts
            </li>
          </ul>
        </div>
      )}
    </form>
  );
}
