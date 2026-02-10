import { useState } from 'react';
import type { LessonSummary } from '../../types';

interface LessonRatingProps {
  lessonId: string;
  existingSummary?: LessonSummary;
  onSubmit: (summary: LessonSummary) => void;
}

export function LessonRating({ lessonId: _lessonId, existingSummary, onSubmit }: LessonRatingProps) {
  const [rating, setRating] = useState(existingSummary?.userRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState(existingSummary?.feedback || '');
  const isReadOnly = !!existingSummary;

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit({
      completedAt: new Date().toISOString(),
      userRating: rating,
      feedback: feedback.trim() || undefined,
    });
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="border-2 border-black p-4 bg-white">
      <h3 className="font-bold text-sm mb-3">
        {isReadOnly ? 'Your Rating' : 'Rate this lesson'}
      </h3>
      <div
        className="flex gap-1 mb-3"
        role="radiogroup"
        aria-label="Rate this lesson 1-5"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className={`text-2xl transition-colors ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            } ${star <= displayRating ? 'text-[#FFDE59]' : 'text-gray-300'}`}
            onClick={() => !isReadOnly && setRating(star)}
            onMouseEnter={() => !isReadOnly && setHoverRating(star)}
            onMouseLeave={() => !isReadOnly && setHoverRating(0)}
            onKeyDown={(e) => {
              if (isReadOnly) return;
              if (e.key === 'ArrowRight' && star < 5) setRating(star + 1);
              if (e.key === 'ArrowLeft' && star > 1) setRating(star - 1);
            }}
            disabled={isReadOnly}
          >
            ★
          </button>
        ))}
      </div>
      {isReadOnly ? (
        feedback && <p className="text-sm text-gray-600 italic">"{feedback}"</p>
      ) : (
        <>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="How was this lesson? Any feedback?"
            className="w-full border-2 border-black p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#FFDE59]"
            maxLength={1000}
          />
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className={`mt-2 px-4 py-2 text-sm font-bold border-2 border-black transition-all ${
              rating > 0
                ? 'bg-[#FFDE59] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none'
                : 'bg-gray-200 cursor-not-allowed'
            }`}
          >
            Submit Rating
          </button>
        </>
      )}
    </div>
  );
}
