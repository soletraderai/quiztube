import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { StaggeredItem } from '../components/ui/StaggeredList';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';

const ITEMS_PER_PAGE = 6; // 6 items for a 3-column grid layout

export default function Library() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { library, syncWithCloud, isSyncing } = useSessionStore();
  const { isAuthenticated } = useAuthStore();

  // Sync with cloud when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      syncWithCloud();
    }
  }, [isAuthenticated, syncWithCloud]);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterBookmarked, setFilterBookmarked] = useState(
    searchParams.get('bookmarked') === 'true'
  );
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(
    (searchParams.get('sort') as 'newest' | 'oldest') || 'newest'
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let sessions = [...library.sessions];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      sessions = sessions.filter(
        (session) =>
          session.video.title.toLowerCase().includes(searchLower) ||
          session.video.channel.toLowerCase().includes(searchLower) ||
          session.topics.some((topic) =>
            topic.title.toLowerCase().includes(searchLower)
          )
      );
    }

    // Apply bookmarked filter
    if (filterBookmarked) {
      sessions = sessions.filter((session) =>
        session.topics.some((topic) => topic.bookmarked)
      );
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0); // Start of day in local timezone
      sessions = sessions.filter((session) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day in local timezone
      sessions = sessions.filter((session) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate <= toDate;
      });
    }

    // Apply sorting
    sessions.sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.createdAt - a.createdAt;
      }
      return a.createdAt - b.createdAt;
    });

    return sessions;
  }, [library.sessions, search, filterBookmarked, sortOrder, dateFrom, dateTo]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSessions.length / ITEMS_PER_PAGE);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Get paginated sessions
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredSessions.slice(startIndex, endIndex);
  }, [filteredSessions, currentPage]);

  // Update URL params when filters change
  const updateParams = (
    newSearch?: string,
    newBookmarked?: boolean,
    newSort?: 'newest' | 'oldest',
    newDateFrom?: string,
    newDateTo?: string,
    newPage?: number,
    resetPage: boolean = true
  ) => {
    const params = new URLSearchParams();
    const searchValue = newSearch !== undefined ? newSearch : search;
    const bookmarkedValue = newBookmarked !== undefined ? newBookmarked : filterBookmarked;
    const sortValue = newSort !== undefined ? newSort : sortOrder;
    const dateFromValue = newDateFrom !== undefined ? newDateFrom : dateFrom;
    const dateToValue = newDateTo !== undefined ? newDateTo : dateTo;
    // Reset page to 1 when filters change, unless explicitly setting page
    const pageValue = newPage !== undefined ? newPage : (resetPage ? 1 : currentPage);

    if (searchValue) params.set('search', searchValue);
    if (bookmarkedValue) params.set('bookmarked', 'true');
    if (sortValue !== 'newest') params.set('sort', sortValue);
    if (dateFromValue) params.set('dateFrom', dateFromValue);
    if (dateToValue) params.set('dateTo', dateToValue);
    if (pageValue > 1) params.set('page', pageValue.toString());

    // Update currentPage state when resetting
    if (resetPage && newPage === undefined) {
      setCurrentPage(1);
    } else if (newPage !== undefined) {
      setCurrentPage(newPage);
    }

    setSearchParams(params);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    updateParams(value);
  };

  const handleBookmarkFilterToggle = () => {
    setFilterBookmarked(!filterBookmarked);
    updateParams(undefined, !filterBookmarked);
  };

  const handleSortChange = () => {
    const newSort = sortOrder === 'newest' ? 'oldest' : 'newest';
    setSortOrder(newSort);
    updateParams(undefined, undefined, newSort);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    updateParams(undefined, undefined, undefined, value);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    updateParams(undefined, undefined, undefined, undefined, value);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterBookmarked(false);
    setSortOrder('newest');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    setSearchParams({});
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      updateParams(undefined, undefined, undefined, undefined, undefined, page, false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const hasActiveFilters = search.trim() || filterBookmarked || sortOrder !== 'newest' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-bold text-text">
            Your Library
          </h1>
          {isSyncing && (
            <span className="text-sm text-text/60 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </span>
          )}
        </div>
        <Button onClick={() => navigate('/')}>
          New Session
        </Button>
      </div>

      {/* Filters */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search sessions"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            <Button
              variant={filterBookmarked ? 'primary' : 'ghost'}
              onClick={handleBookmarkFilterToggle}
              aria-pressed={filterBookmarked}
            >
              Bookmarked
            </Button>

            <Button
              variant="ghost"
              onClick={handleSortChange}
              aria-label={`Sort by ${sortOrder === 'newest' ? 'oldest' : 'newest'} first`}
            >
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="date-from"
              className="block font-heading font-semibold text-text text-sm mb-1"
            >
              From Date
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              max={dateTo || undefined}
              className="w-full px-4 py-2 border-3 border-border bg-surface font-body text-text
                focus:outline-none focus:shadow-brutal transition-shadow"
              aria-label="Filter from date"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label
              htmlFor="date-to"
              className="block font-heading font-semibold text-text text-sm mb-1"
            >
              To Date
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              min={dateFrom || undefined}
              className="w-full px-4 py-2 border-3 border-border bg-surface font-body text-text
                focus:outline-none focus:shadow-brutal transition-shadow"
              aria-label="Filter to date"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                updateParams(undefined, undefined, undefined, '', '');
              }}
              className="whitespace-nowrap"
            >
              Clear Dates
            </Button>
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-text/70">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </p>
      </Card>

      {/* Sessions Grid */}
      <h2 className="sr-only">Sessions</h2>
      {filteredSessions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedSessions.map((session, index) => (
            <StaggeredItem key={session.id} index={index} baseDelay={100} staggerDelay={75}>
            <Card
              hoverable
              className="h-full"
              onClick={() => navigate(`/session/${session.id}/notes`)}
            >
              {/* Thumbnail */}
              {session.video.thumbnailUrl && (
                <img
                  src={session.video.thumbnailUrl}
                  alt={`Thumbnail for ${session.video.title}`}
                  className="w-full h-36 object-cover border-3 border-border mb-4"
                  loading="lazy"
                />
              )}

              {/* Bookmark indicator */}
              {session.topics.some((t) => t.bookmarked) && (
                <div className="absolute top-2 right-2 bg-primary border-2 border-border px-2 py-1 text-xs font-heading font-bold">
                  Bookmarked
                </div>
              )}

              {/* Title */}
              <h3 className="font-heading font-semibold text-lg text-text line-clamp-2">
                {session.video.title}
              </h3>

              {/* Channel */}
              <p className="text-sm text-text/70 mt-2">
                {session.video.channel}
              </p>

              {/* Date */}
              <p className="text-xs text-text/50 mt-1">
                {new Date(session.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>

              {/* Stats */}
              <div className="mt-4 pt-3 border-t-2 border-border/30 flex justify-between text-sm">
                <span className="font-heading">
                  {session.score.topicsCompleted}/{session.topics.length} topics
                </span>
                <span className="text-text/70">
                  {session.score.questionsAnswered} answers
                </span>
              </div>
            </Card>
            </StaggeredItem>
          ))}
        </div>
      ) : null}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-sm text-text/70">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredSessions.length)} of{' '}
            {filteredSessions.length} sessions
          </div>

          <nav className="flex items-center gap-2" aria-label="Pagination">
            <Button
              variant="ghost"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              aria-label="Go to previous page"
            >
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first, last, current, and adjacent pages
                const showPage =
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1;

                if (!showPage) {
                  if (
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <span
                        key={`ellipsis-${page}`}
                        className="px-2 text-text/50"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 flex items-center justify-center border-3 border-border font-heading font-bold transition-colors ${
                      page === currentPage
                        ? 'bg-primary text-text'
                        : 'bg-surface text-text hover:bg-primary/20'
                    }`}
                    aria-label={`Go to page ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </nav>
        </div>
      )}

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        // Empty state
        <Card className="text-center py-12">
          <div className="space-y-4">
            <svg
              className="w-16 h-16 mx-auto text-text/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>

            {hasActiveFilters ? (
              <>
                <h3 className="font-heading text-xl font-bold text-text">
                  No matching sessions
                </h3>
                <p className="text-text/70">
                  Try adjusting your search or filters
                </p>
                <Button onClick={clearFilters}>
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-heading text-xl font-bold text-text">
                  Your library is empty
                </h3>
                <p className="text-text/70">
                  Complete your first learning session to see it here!
                </p>
                <Button onClick={() => navigate('/')}>
                  Start Learning
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
