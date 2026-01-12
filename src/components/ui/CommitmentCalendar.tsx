import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface CalendarDay {
  date: string;
  commitmentMet: boolean;
  timeSpentMinutes: number;
  vacationMode: boolean;
}

interface CalendarData {
  calendar: CalendarDay[];
  consistency: string | number;
  metDays: number;
  totalDays: number;
}

const API_BASE = 'http://localhost:3002/api';

export default function CommitmentCalendar() {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const fetchCalendar = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/commitment/calendar?view=${view}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch calendar data');
        }

        const data = await response.json();
        setCalendarData(data);
      } catch (err) {
        console.error('Failed to fetch calendar:', err);
        setError(err instanceof Error ? err.message : 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, [accessToken, isAuthenticated, view]);

  if (!isAuthenticated()) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6 bg-surface border-3 border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-border/20 animate-pulse" />
          <div className="h-8 w-24 bg-border/20 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(view === 'week' ? 7 : 30)].map((_, i) => (
            <div key={i} className="flex-1 h-12 bg-border/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-surface border-3 border-border text-center">
        <p className="text-text/70">{error}</p>
      </div>
    );
  }

  if (!calendarData) {
    return null;
  }

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayOfMonth = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate();
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return today.toISOString().split('T')[0] === date.toISOString().split('T')[0];
  };

  const isFuture = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString);
    return date > today;
  };

  return (
    <div className="p-6 bg-surface border-3 border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-lg text-text">Learning Activity</h3>
          <p className="text-sm text-text/60">
            {calendarData.metDays} of {calendarData.totalDays} days • {calendarData.consistency}% consistency
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-sm font-heading font-semibold border-2 border-border transition-all ${
              view === 'week'
                ? 'bg-primary shadow-brutal-sm'
                : 'bg-surface hover:bg-primary/30'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-sm font-heading font-semibold border-2 border-border transition-all ${
              view === 'month'
                ? 'bg-primary shadow-brutal-sm'
                : 'bg-surface hover:bg-primary/30'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`grid gap-2 ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7 sm:grid-cols-10'}`}>
        {calendarData.calendar.map((day) => {
          const future = isFuture(day.date);
          const today = isToday(day.date);

          // Determine day styling:
          // - Future days: very light, not styled
          // - Vacation mode: neutral/grey (not penalized)
          // - Commitment met: success green
          // - Commitment NOT met (missed day): NEUTRAL GREY (NOT red - per feature requirement)
          // - Today: highlighted border

          let dayClass = 'p-2 text-center border-2 transition-all ';

          if (future) {
            // Future days - very light, no status yet
            dayClass += 'bg-background border-border/30 text-text/30';
          } else if (day.vacationMode) {
            // Vacation mode - neutral styling (not counted)
            dayClass += 'bg-background border-border/50 text-text/50';
          } else if (day.commitmentMet) {
            // Commitment met - success
            dayClass += 'bg-success/20 border-success text-success';
          } else {
            // Missed day - NEUTRAL GREY (not alarming red)
            // This is the key requirement for feature #491
            dayClass += 'bg-text/5 border-border/50 text-text/40';
          }

          // Today highlight
          if (today) {
            dayClass += ' ring-2 ring-primary ring-offset-1';
          }

          return (
            <div
              key={day.date}
              className={dayClass}
              title={`${new Date(day.date).toLocaleDateString()} - ${
                future
                  ? 'Upcoming'
                  : day.vacationMode
                    ? 'Vacation'
                    : day.commitmentMet
                      ? 'Goal reached'
                      : 'No activity'
              }${day.timeSpentMinutes > 0 ? ` (${day.timeSpentMinutes} min)` : ''}`}
            >
              {view === 'week' && (
                <div className="text-xs font-heading opacity-70 mb-1">
                  {getDayOfWeek(day.date)}
                </div>
              )}
              <div className={`font-heading font-bold ${view === 'week' ? 'text-lg' : 'text-sm'}`}>
                {getDayOfMonth(day.date)}
              </div>
              {/* Status indicator */}
              {!future && (
                <div className="mt-1">
                  {day.vacationMode ? (
                    <span className="text-xs">✈️</span>
                  ) : day.commitmentMet ? (
                    <svg className="w-4 h-4 mx-auto text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    // Neutral dot for missed days - NOT an X or alarming icon
                    <div className="w-2 h-2 mx-auto bg-text/20 rounded-full" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/30 text-xs text-text/60">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-success/20 border border-success" />
          <span>Goal reached</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-text/5 border border-border/50" />
          <span>No activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-background border border-border/30" />
          <span>Upcoming</span>
        </div>
      </div>
    </div>
  );
}
