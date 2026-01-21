import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import CompletionCheckmark from '../components/ui/CompletionCheckmark';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { useDocumentTitle } from '../hooks';
import { generateStructuredNotes } from '../services/gemini';
import type { StructuredNotes } from '../types';

const API_BASE = 'http://localhost:3001/api';

interface AITakeaway {
  id: number;
  text: string;
  category: 'concept' | 'insight' | 'action' | 'connection';
}

interface Recommendation {
  id: number;
  title: string;
  description: string;
  action: 'new_session' | 'review' | 'continue' | 'explore';
  link?: string;
  buttonText: string;
}

export default function SessionNotes() {
  useDocumentTitle('Lesson Notes');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { getSession, updateSession } = useSessionStore();
  const { accessToken, isAuthenticated, user } = useAuthStore();

  const [showCompletionCheckmark, setShowCompletionCheckmark] = useState(false);
  const [showFollowPrompt, setShowFollowPrompt] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isAlreadyFollowing, setIsAlreadyFollowing] = useState(false);
  const [followDismissed, setFollowDismissed] = useState(false);
  const [aiTakeaways, setAiTakeaways] = useState<AITakeaway[]>([]);
  const [loadingTakeaways, setLoadingTakeaways] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [structuredNotes, setStructuredNotes] = useState<StructuredNotes | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const session = sessionId ? getSession(sessionId) : undefined;
  const { library } = useSessionStore();
  const isPro = user?.tier === 'PRO';

  // Generate AI takeaways based on session content
  const generateTakeaways = (): AITakeaway[] => {
    if (!session) return [];

    const takeaways: AITakeaway[] = [];
    let idCounter = 1;

    // Analyze topics and generate meaningful takeaways
    const completedTopics = session.topics.filter(t => t.completed && !t.skipped);
    const answeredQuestions = session.topics.flatMap(t =>
      t.questions.filter(q => q.userAnswer)
    );

    // Takeaway 1: Main concept from the video
    if (session.video.title) {
      const videoSubject = session.video.title
        .replace(/[-|:].*$/, '')
        .replace(/\(.*\)/, '')
        .trim();
      takeaways.push({
        id: idCounter++,
        text: `This session covered "${videoSubject}" with ${session.topics.length} distinct topics to master.`,
        category: 'concept'
      });
    }

    // Takeaway 2: Learning depth based on questions answered
    if (answeredQuestions.length > 0) {
      const engagementLevel = answeredQuestions.length >= 5 ? 'deep' :
                              answeredQuestions.length >= 3 ? 'solid' : 'initial';
      takeaways.push({
        id: idCounter++,
        text: `You demonstrated ${engagementLevel} engagement by answering ${answeredQuestions.length} question${answeredQuestions.length !== 1 ? 's' : ''}, reinforcing your understanding through active recall.`,
        category: 'insight'
      });
    }

    // Takeaway 3: Topic mastery insights
    if (completedTopics.length > 0) {
      const topTopics = completedTopics.slice(0, 2).map(t => t.title).join(' and ');
      takeaways.push({
        id: idCounter++,
        text: `Key topics mastered include: ${topTopics}. These form the foundation for more advanced concepts.`,
        category: 'concept'
      });
    }

    // Takeaway 4: Action recommendation
    if (session.score.bookmarkedTopics > 0) {
      takeaways.push({
        id: idCounter++,
        text: `You bookmarked ${session.score.bookmarkedTopics} topic${session.score.bookmarkedTopics !== 1 ? 's' : ''} for review. Schedule time to revisit these within 48 hours for optimal retention.`,
        category: 'action'
      });
    } else if (session.topics.length > 0) {
      takeaways.push({
        id: idCounter++,
        text: `Consider reviewing the most challenging topics within the next few days to strengthen long-term memory.`,
        category: 'action'
      });
    }

    // Takeaway 5: Connection to broader learning
    if (session.score.digDeeperCount > 0) {
      takeaways.push({
        id: idCounter++,
        text: `Your ${session.score.digDeeperCount} deep dive exploration${session.score.digDeeperCount !== 1 ? 's' : ''} show${session.score.digDeeperCount === 1 ? 's' : ''} excellent curiosity - this type of active learning leads to better retention.`,
        category: 'connection'
      });
    } else {
      takeaways.push({
        id: idCounter++,
        text: `Try the "Dig Deeper" feature in future sessions to explore concepts that spark your curiosity.`,
        category: 'connection'
      });
    }

    // Ensure we have 3-5 takeaways
    return takeaways.slice(0, 5);
  };

  // Generate recommendations based on session data
  const generateRecommendations = (): Recommendation[] => {
    if (!session) return [];

    const recs: Recommendation[] = [];
    let idCounter = 1;

    // Check for incomplete topics to continue
    const incompleteTopic = session.topics.find(t => !t.completed && !t.skipped);
    if (incompleteTopic) {
      recs.push({
        id: idCounter++,
        title: 'Continue This Session',
        description: `You still have ${session.topics.filter(t => !t.completed && !t.skipped).length} topic(s) to complete in this session.`,
        action: 'continue',
        link: `/session/${session.id}/active`,
        buttonText: 'Continue Learning'
      });
    }

    // Recommend review if there are bookmarked topics
    if (session.score.bookmarkedTopics > 0) {
      recs.push({
        id: idCounter++,
        title: 'Review Bookmarked Topics',
        description: `Review your ${session.score.bookmarkedTopics} bookmarked topic(s) to reinforce key concepts.`,
        action: 'review',
        link: '/review',
        buttonText: 'Start Review'
      });
    }

    // Find related content from same channel
    const sameChannelSessions = library.sessions.filter(
      s => s.id !== session.id && s.video.channel === session.video.channel
    );
    if (sameChannelSessions.length > 0) {
      const relatedSession = sameChannelSessions[0];
      recs.push({
        id: idCounter++,
        title: `More from ${session.video.channel}`,
        description: `Continue learning with "${relatedSession.video.title.slice(0, 50)}${relatedSession.video.title.length > 50 ? '...' : ''}"`,
        action: 'explore',
        link: `/session/${relatedSession.id}/notes`,
        buttonText: 'View Session'
      });
    }

    // Always recommend starting a new session
    recs.push({
      id: idCounter++,
      title: 'Start a New Session',
      description: 'Paste a YouTube URL to create a new learning session on any topic.',
      action: 'new_session',
      link: '/',
      buttonText: 'New Session'
    });

    // Recommend exploring the library if they have multiple sessions
    if (library.sessions.length > 3) {
      recs.push({
        id: idCounter++,
        title: 'Explore Your Library',
        description: `You have ${library.sessions.length} sessions in your library. Review past learnings to strengthen retention.`,
        action: 'explore',
        link: '/library',
        buttonText: 'View Library'
      });
    }

    return recs.slice(0, 4); // Max 4 recommendations
  };

  // Generate Markdown export content
  const generateMarkdown = (): string => {
    if (!session) return '';

    let md = `# Session Notes: ${session.video.title}\n\n`;
    md += `**Channel:** ${session.video.channel}\n`;
    md += `**Date:** ${new Date(session.createdAt).toLocaleDateString()}\n`;
    md += `**Video URL:** ${session.video.url}\n\n`;

    md += `## Session Score\n\n`;
    md += `- Topics Completed: ${session.score.topicsCompleted}/${session.topics.length}\n`;
    md += `- Questions Answered: ${session.score.questionsAnswered}\n`;
    md += `- Bookmarked Topics: ${session.score.bookmarkedTopics}\n`;
    md += `- Dig Deeper Count: ${session.score.digDeeperCount}\n\n`;

    if (aiTakeaways.length > 0) {
      md += `## Key Takeaways\n\n`;
      aiTakeaways.forEach((takeaway) => {
        md += `- ${takeaway.text}\n`;
      });
      md += '\n';
    }

    md += `## Topics & Questions\n\n`;
    session.topics.forEach((topic, index) => {
      md += `### ${index + 1}. ${topic.title}\n\n`;
      if (topic.completed) md += `✅ Completed\n`;
      if (topic.bookmarked) md += `🔖 Bookmarked\n`;
      if (topic.skipped) md += `⏭️ Skipped\n`;
      md += `\n**Summary:** ${topic.summary}\n\n`;

      topic.questions.forEach((q, qIndex) => {
        md += `**Q${qIndex + 1}:** ${q.text}\n\n`;
        if (q.userAnswer) {
          md += `**Your Answer:** ${q.userAnswer}\n\n`;
        }
        if (q.feedback) {
          md += `**Feedback:** ${q.feedback}\n\n`;
        }
      });
    });

    md += `---\n`;
    md += `*Exported from QuizTube on ${new Date().toLocaleDateString()}*\n`;

    return md;
  };

  // Export as Markdown file
  const exportMarkdown = () => {
    if (!session) return;

    setIsExporting(true);
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-notes-${session.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setShowExportMenu(false);
  };

  // Export as PDF (using browser print)
  const exportPDF = () => {
    if (!session) return;

    setIsExporting(true);
    // Create a printable version
    const printContent = `
      <html>
        <head>
          <title>Session Notes - ${session.video.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #FFD700; padding-bottom: 10px; }
            h2 { color: #444; margin-top: 30px; }
            h3 { color: #555; }
            .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
            .score-item { padding: 10px; background: #f5f5f5; border: 1px solid #ddd; text-align: center; }
            .score-value { font-size: 24px; font-weight: bold; }
            .topic { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
            .question { margin: 10px 0; padding: 10px; background: #f9f9f9; }
            .answer { color: #2563eb; }
            .feedback { color: #16a34a; }
            .takeaway { padding: 8px; margin: 5px 0; background: #fffbeb; border-left: 3px solid #FFD700; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Session Notes: ${session.video.title}</h1>
          <p><strong>Channel:</strong> ${session.video.channel}</p>
          <p><strong>Date:</strong> ${new Date(session.createdAt).toLocaleDateString()}</p>
          <p><strong>Video:</strong> <a href="${session.video.url}">${session.video.url}</a></p>

          <h2>Session Score</h2>
          <div class="score-grid">
            <div class="score-item"><div class="score-value">${session.score.topicsCompleted}</div>Completed</div>
            <div class="score-item"><div class="score-value">${session.score.questionsAnswered}</div>Answered</div>
            <div class="score-item"><div class="score-value">${session.score.bookmarkedTopics}</div>Bookmarked</div>
          </div>

          ${aiTakeaways.length > 0 ? `
            <h2>Key Takeaways</h2>
            ${aiTakeaways.map(t => `<div class="takeaway">${t.text}</div>`).join('')}
          ` : ''}

          <h2>Topics & Questions</h2>
          ${session.topics.map((topic, i) => `
            <div class="topic">
              <h3>${i + 1}. ${topic.title}</h3>
              <p><em>${topic.summary}</em></p>
              ${topic.questions.map((q, qi) => `
                <div class="question">
                  <p><strong>Q${qi + 1}:</strong> ${q.text}</p>
                  ${q.userAnswer ? `<p class="answer"><strong>Your Answer:</strong> ${q.userAnswer}</p>` : ''}
                  ${q.feedback ? `<p class="feedback"><strong>Feedback:</strong> ${q.feedback}</p>` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}

          <hr>
          <p><em>Exported from QuizTube on ${new Date().toLocaleDateString()}</em></p>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        setIsExporting(false);
        setShowExportMenu(false);
      };
    } else {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  // Load takeaways and recommendations when session is available
  useEffect(() => {
    if (session && aiTakeaways.length === 0) {
      setLoadingTakeaways(true);
      // Simulate AI processing delay for better UX
      const timer = setTimeout(() => {
        setAiTakeaways(generateTakeaways());
        setRecommendations(generateRecommendations());
        setLoadingTakeaways(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [session]);

  // Show completion checkmark animation on first visit to completed session
  useEffect(() => {
    if (session?.completedAt) {
      // Check if we've already shown the checkmark for this session
      const checkmarkShownKey = `checkmark_shown_${sessionId}`;
      const hasShown = sessionStorage.getItem(checkmarkShownKey);
      if (!hasShown) {
        setShowCompletionCheckmark(true);
        sessionStorage.setItem(checkmarkShownKey, 'true');
      }
    }
  }, [session?.completedAt, sessionId]);

  // Generate structured notes from transcript or topics
  useEffect(() => {
    const generateNotes = async () => {
      if (!session || !sessionId) return;

      // If notes already exist in the session, use them
      if (session.structuredNotes) {
        setStructuredNotes(session.structuredNotes);
        return;
      }

      // If there's a transcript, generate notes from it
      if (session.transcript) {
        setLoadingNotes(true);
        setNotesError(null);
        try {
          const notes = await generateStructuredNotes(
            session.video.title,
            session.transcript,
            session.video.duration
          );
          const structuredNotesData: StructuredNotes = {
            generatedAt: Date.now(),
            sections: notes.sections,
            summary: notes.summary,
          };
          setStructuredNotes(structuredNotesData);
          // Save to session for future access
          updateSession(sessionId, { structuredNotes: structuredNotesData });
        } catch (error) {
          console.error('Failed to generate structured notes:', error);
          setNotesError('Failed to generate notes. Please try again later.');
        } finally {
          setLoadingNotes(false);
        }
      } else if (session.topics && session.topics.length > 0) {
        // Generate notes from topics as fallback
        const formatTimestamp = (index: number, total: number): string => {
          const estimatedDuration = session.video.duration || 600;
          const seconds = Math.floor((index / total) * estimatedDuration);
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
        };

        const topicNotes: StructuredNotes = {
          generatedAt: Date.now(),
          sections: session.topics.map((topic, index) => ({
            id: topic.id,
            title: topic.title,
            timestamp: formatTimestamp(index, session.topics.length),
            content: topic.summary,
            keyPoints: topic.questions.slice(0, 3).map(q => q.text),
          })),
          summary: `Learning notes for "${session.video.title}" covering ${session.topics.length} key topics from ${session.video.channel}.`,
        };
        setStructuredNotes(topicNotes);
        // Save to session for future access
        updateSession(sessionId, { structuredNotes: topicNotes });
      }
    };

    generateNotes();
  }, [session, sessionId, updateSession]);

  // Generate a channelId from the channel name (slugified)
  const getChannelId = (channelName: string) => {
    return channelName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  };

  // Check if channel is already followed
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!session || !isAuthenticated() || !session.video.channel) return;

      const channelId = getChannelId(session.video.channel);

      try {
        const response = await fetch(`${API_BASE}/channels`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const channels = await response.json();
          const isFollowed = channels.some(
            (c: { channelId: string }) => c.channelId === channelId
          );
          setIsAlreadyFollowing(isFollowed);

          // Show prompt if session is complete and channel is not followed
          if (session.completedAt && !isFollowed && !followDismissed) {
            setShowFollowPrompt(true);
          }
        }
      } catch (error) {
        console.error('Failed to check follow status:', error);
      }
    };

    checkFollowStatus();
  }, [session, accessToken, isAuthenticated, followDismissed]);

  const handleFollowChannel = async () => {
    if (!session || !session.video.channel) return;

    const channelId = getChannelId(session.video.channel);

    setIsFollowing(true);
    try {
      const response = await fetch(`${API_BASE}/channels/${channelId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          channelName: session.video.channel,
          channelThumbnail: null, // We don't have channel thumbnail
        }),
      });

      if (response.ok) {
        setIsAlreadyFollowing(true);
        setShowFollowPrompt(false);
      }
    } catch (error) {
      console.error('Failed to follow channel:', error);
    } finally {
      setIsFollowing(false);
    }
  };

  const handleDismissFollowPrompt = () => {
    setFollowDismissed(true);
    setShowFollowPrompt(false);
  };

  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center py-12 max-w-md">
          <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold text-text">
              Session Not Found
            </h1>
            <p className="text-text/70">
              This session doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate('/library')}>
              Go to Library
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate completion percentage
  const completionRate = session.score.topicsCompleted / session.topics.length;
  const hasAnsweredQuestions = session.score.questionsAnswered > 0;

  // Calculate accuracy percentage
  const accuracy = session.score.questionsAnswered > 0
    ? Math.round((session.score.questionsCorrect / session.score.questionsAnswered) * 100)
    : 0;
  const isPerfectScore = session.score.questionsAnswered > 0 && accuracy === 100;

  // Get encouraging message based on performance
  const getCompletionMessage = () => {
    if (isPerfectScore) {
      return "Outstanding! You achieved a perfect score on all questions!";
    } else if (completionRate >= 0.8 && hasAnsweredQuestions) {
      return "Excellent work! You've demonstrated great engagement with the material.";
    } else if (completionRate >= 0.5) {
      return "Good progress! Keep learning and exploring new topics.";
    } else if (hasAnsweredQuestions) {
      return "Nice effort! Every question answered helps build understanding.";
    } else {
      return "Session complete! Consider revisiting topics for deeper learning.";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Completion Checkmark Animation */}
      <CompletionCheckmark
        show={showCompletionCheckmark}
        onComplete={() => setShowCompletionCheckmark(false)}
        size="lg"
        message={isPerfectScore ? "Perfect Score!" : "Session Complete!"}
      />

      {/* Congratulations Banner */}
      {session.completedAt && (
        <Card className="bg-success/20 border-success">
          <div className="text-center py-4">
            {/* Phase 7 F7: Changed to text-text (black) */}
            <h2 className="font-heading text-xl font-bold text-text mb-2">
              Session Complete!
            </h2>

            {/* Perfect Score Badge */}
            {isPerfectScore && (
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-3 bg-primary border-3 border-border shadow-brutal-sm">
                <svg className="w-5 h-5 text-text" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-heading font-bold text-text">Perfect Score!</span>
              </div>
            )}

            <p className="text-text/80 mb-4">
              {getCompletionMessage()}
            </p>

            {/* Completion Progress Bar */}
            <div className="max-w-md mx-auto">
              <ProgressBar
                current={session.score.topicsCompleted}
                total={session.topics.length}
                label="Completion"
                showPercentage={true}
                showCount={false}
              />
            </div>

            {/* Phase 7 F8: Score Breakdown Display */}
            {session.score.questionsAnswered > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {/* Passed */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/20 border-2 border-success rounded-full">
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-semibold text-success">
                    {session.score.questionsPassed || 0} Passed
                  </span>
                </div>
                {/* Failed */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error/20 border-2 border-error rounded-full">
                  <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-semibold text-error">
                    {session.score.questionsFailed || 0} Failed
                  </span>
                </div>
                {/* Partial/Neutral */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning/20 border-2 border-warning rounded-full">
                  <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-semibold text-warning">
                    {session.score.questionsNeutral || 0} Partial
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Follow Channel Prompt */}
      {showFollowPrompt && session.video.channel && (
        <Card className="bg-secondary/20 border-secondary">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center border-2 border-border">
                <svg
                  className="w-6 h-6 text-text"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-heading font-bold text-text">
                  Follow {session.video.channel}?
                </p>
                <p className="text-sm text-text/70">
                  Get notified about new videos from this channel
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleFollowChannel}
                disabled={isFollowing}
                variant="primary"
              >
                {isFollowing ? 'Following...' : 'Follow Channel'}
              </Button>
              <Button
                onClick={handleDismissFollowPrompt}
                variant="ghost"
              >
                Not Now
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Already Following Badge */}
      {isAlreadyFollowing && session.video.channel && !showFollowPrompt && (
        <Card className="bg-primary/10 border-primary">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-success"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-text">
              You're following <strong>{session.video.channel}</strong>
            </p>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <h1 className="font-heading text-3xl font-bold text-text">
          Session Notes
        </h1>
        <div className="flex gap-2 flex-wrap">
          {/* Export Button */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {isExporting ? 'Exporting...' : 'Export'}
              {!isPro && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-secondary border border-border">
                  PRO
                </span>
              )}
            </Button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-surface border-3 border-border shadow-brutal z-50">
                {isPro ? (
                  <>
                    <button
                      onClick={exportPDF}
                      className="w-full px-4 py-3 text-left font-heading text-sm hover:bg-primary/20 flex items-center gap-2 border-b-2 border-border"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Export as PDF
                    </button>
                    <button
                      onClick={exportMarkdown}
                      className="w-full px-4 py-3 text-left font-heading text-sm hover:bg-primary/20 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export as Markdown
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-secondary/20 border-2 border-border rounded-full">
                      <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="font-heading font-bold text-text mb-1">
                      Export is a Pro Feature
                    </p>
                    <p className="text-sm text-text/70 mb-3">
                      Upgrade to Pro to export your session notes as PDF or Markdown.
                    </p>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        navigate('/pricing');
                      }}
                      className="w-full px-4 py-2 font-heading font-bold bg-secondary border-2 border-border shadow-brutal-sm hover:shadow-brutal transition-all"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button onClick={() => navigate('/')}>
            New Session
          </Button>
          <Button variant="ghost" onClick={() => navigate('/library')}>
            Library
          </Button>
        </div>
      </div>

      {/* Video Info Card */}
      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          {session.video.thumbnailUrl && (
            <div className="md:w-1/3">
              <img
                src={session.video.thumbnailUrl}
                alt={`Thumbnail for ${session.video.title}`}
                className="w-full h-auto border-3 border-border"
              />
            </div>
          )}

          <div className="flex-1 space-y-3">
            <h2 className="font-heading text-xl font-bold text-text">
              {session.video.title}
            </h2>
            <p className="text-text/70">{session.video.channel}</p>
            <a
              href={session.video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline text-sm"
            >
              Watch on YouTube
            </a>

            <div className="pt-3 border-t-2 border-border/30 text-sm text-text/70">
              <p>Started: {formatDate(session.createdAt)}</p>
              {session.completedAt && (
                <p>Completed: {formatDate(session.completedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Score Summary */}
      <Card className="bg-primary/10">
        <h2 className="font-heading text-xl font-bold text-text mb-4">
          Session Score
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-surface border-2 border-border">
            <AnimatedNumber
              value={session.score.topicsCompleted}
              className="text-3xl font-heading font-bold text-success"
            />
            <p className="text-xs text-text/70 mt-1">Completed</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <AnimatedNumber
              value={session.score.topicsSkipped}
              className="text-3xl font-heading font-bold text-text/50"
            />
            <p className="text-xs text-text/70 mt-1">Skipped</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <AnimatedNumber
              value={session.score.questionsAnswered}
              className="text-3xl font-heading font-bold text-secondary"
            />
            <p className="text-xs text-text/70 mt-1">Answered</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <AnimatedNumber
              value={session.score.bookmarkedTopics}
              className="text-3xl font-heading font-bold text-primary"
            />
            <p className="text-xs text-text/70 mt-1">Bookmarked</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <AnimatedNumber
              value={session.score.digDeeperCount}
              className="text-3xl font-heading font-bold text-text"
            />
            <p className="text-xs text-text/70 mt-1">Dig Deeper</p>
          </div>
        </div>

        {/* Accuracy indicator */}
        {session.score.questionsAnswered > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-border/30 text-center">
            <p className="text-sm text-text/70">
              Accuracy: <AnimatedNumber value={accuracy} suffix="%" className="font-heading font-bold text-text" />
            </p>
          </div>
        )}
      </Card>

      {/* AI Key Takeaways */}
      <Card className="bg-secondary/10 border-secondary">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-secondary border-2 border-border">
            <svg
              className="w-5 h-5 text-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-text">
              Key Takeaways
            </h2>
            <p className="text-xs text-text/60">AI-generated insights from your session</p>
          </div>
        </div>

        {loadingTakeaways ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-6 h-6 bg-border/30 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-border/30 rounded w-full" />
                  <div className="h-4 bg-border/30 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3" role="list" aria-label="Key takeaways from this session">
            {aiTakeaways.map((takeaway) => {
              const categoryColors = {
                concept: 'bg-primary/30 text-text',
                insight: 'bg-secondary/30 text-text',
                action: 'bg-success/30 text-text',
                connection: 'bg-accent/30 text-text'
              };
              const categoryIcons = {
                concept: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                ),
                insight: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                action: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
                connection: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )
              };

              return (
                <li
                  key={takeaway.id}
                  className="flex gap-3 p-3 bg-surface border-2 border-border"
                  role="listitem"
                >
                  <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 border-2 border-border ${categoryColors[takeaway.category]}`}>
                    {categoryIcons[takeaway.category]}
                  </div>
                  <p className="text-text text-sm leading-relaxed flex-1">
                    {takeaway.text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {aiTakeaways.length > 0 && (
          <p className="mt-4 text-xs text-text/50 text-center">
            Generated based on your learning patterns and session data
          </p>
        )}
      </Card>

      {/* Structured Notes from Transcript */}
      {(loadingNotes || structuredNotes || notesError) && (
        <Card className="bg-accent/10 border-accent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-accent border-2 border-border">
              <svg
                className="w-5 h-5 text-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-text">
                Structured Learning Notes
              </h2>
              <p className="text-xs text-text/60">AI-generated notes from video transcript</p>
            </div>
          </div>

          {loadingNotes && (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-4 bg-border/30 rounded w-3/4 mb-2" />
                <div className="h-4 bg-border/30 rounded w-full mb-2" />
                <div className="h-4 bg-border/30 rounded w-5/6" />
              </div>
              <p className="text-sm text-text/60 text-center">Generating structured notes...</p>
            </div>
          )}

          {notesError && (
            <div className="text-center py-4">
              <p className="text-error mb-2">{notesError}</p>
              <p className="text-sm text-text/60">Notes could not be generated for this session.</p>
            </div>
          )}

          {structuredNotes && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-surface border-2 border-border">
                <h3 className="font-heading font-bold text-text mb-2">Summary</h3>
                <p className="text-text/80">{structuredNotes.summary}</p>
              </div>

              {/* Sections with timestamps */}
              <div className="space-y-4">
                {structuredNotes.sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="p-4 bg-surface border-2 border-border"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-bold bg-accent/30 border border-border">
                        {section.timestamp}
                      </span>
                      <h3 className="font-heading font-bold text-text flex-1">
                        {index + 1}. {section.title}
                      </h3>
                    </div>

                    {/* Key Points */}
                    {section.keyPoints.length > 0 && (
                      <ul className="mb-3 space-y-1">
                        {section.keyPoints.map((point, pIndex) => (
                          <li key={pIndex} className="flex items-start gap-2 text-sm">
                            <span className="text-accent font-bold">•</span>
                            <span className="text-text/80">{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Content */}
                    <p className="text-text/70 text-sm leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-text/50 text-center">
                Generated from video transcript on {new Date(structuredNotes.generatedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Recommendations / Next Steps */}
      {recommendations.length > 0 && (
        <Card className="bg-primary/10 border-primary">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-primary border-2 border-border">
              <svg
                className="w-5 h-5 text-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-text">
                Recommended Next Steps
              </h2>
              <p className="text-xs text-text/60">Personalized suggestions based on your progress</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((rec) => {
              const actionColors = {
                new_session: 'bg-primary hover:bg-primary/80',
                review: 'bg-secondary hover:bg-secondary/80',
                continue: 'bg-success hover:bg-success/80',
                explore: 'bg-accent hover:bg-accent/80'
              };

              return (
                <div
                  key={rec.id}
                  className="p-4 bg-surface border-2 border-border flex flex-col justify-between gap-3"
                >
                  <div>
                    <h3 className="font-heading font-bold text-text mb-1">
                      {rec.title}
                    </h3>
                    <p className="text-sm text-text/70">
                      {rec.description}
                    </p>
                  </div>
                  <button
                    onClick={() => rec.link && navigate(rec.link)}
                    className={`px-4 py-2 font-heading font-semibold text-text border-2 border-border shadow-brutal-sm hover:shadow-brutal transition-all text-sm ${actionColors[rec.action]}`}
                  >
                    {rec.buttonText}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Topics & Q&A */}
      <div className="space-y-6">
        <h2 className="font-heading text-xl font-bold text-text">
          Topics & Questions
        </h2>

        {session.topics.map((topic, topicIndex) => (
          <Card
            key={topic.id}
            className={`${topic.bookmarked ? 'border-primary border-4' : ''}`}
          >
            {/* Topic Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-primary border-2 border-border font-heading font-bold text-sm">
                    {topicIndex + 1}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-text">
                    {topic.title}
                  </h3>
                </div>
              </div>

              <div className="flex gap-2">
                {topic.skipped && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-text/10 border-2 border-border">
                    Skipped
                  </span>
                )}
                {topic.bookmarked && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-primary border-2 border-border">
                    Bookmarked
                  </span>
                )}
                {topic.completed && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-success border-2 border-border">
                    Completed
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="mb-4 p-3 bg-secondary/10 border-2 border-border">
              <p className="text-sm font-heading font-semibold text-secondary mb-1">
                Summary
              </p>
              <p className="text-text">{topic.summary}</p>
            </div>

            {/* Questions */}
            {topic.questions.map((question, qIndex) => (
              <div
                key={question.id}
                className="mb-4 last:mb-0 p-4 bg-surface border-2 border-border"
              >
                <p className="font-heading font-semibold text-text mb-2">
                  Q{qIndex + 1}: {question.text}
                </p>

                {question.userAnswer && (
                  <div className="mt-3">
                    <p className="text-sm font-heading text-text/70 mb-1">
                      Your Answer:
                    </p>
                    <p className="text-text bg-primary/10 p-2 border border-border">
                      {question.userAnswer}
                    </p>
                  </div>
                )}

                {question.feedback && (
                  <div className="mt-3">
                    <p className="text-sm font-heading text-success mb-1">
                      Feedback:
                    </p>
                    <p className="text-text">{question.feedback}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Dig Deeper Conversation */}
            {topic.digDeeperConversation && topic.digDeeperConversation.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-border/30">
                <p className="font-heading font-semibold text-text mb-3">
                  Dig Deeper Conversation
                </p>
                <div className="space-y-2">
                  {topic.digDeeperConversation.map((message, mIndex) => (
                    <div
                      key={mIndex}
                      className={`p-3 ${
                        message.role === 'user'
                          ? 'bg-primary/20 ml-8'
                          : 'bg-secondary/20 mr-8'
                      } border-2 border-border`}
                    >
                      <p className="text-xs text-text/70 mb-1">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      <p className="text-text">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Saved Code Snippets */}
      {session.savedSnippets && session.savedSnippets.length > 0 && (
        <Card className="bg-gray-900 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-green-600 border-2 border-black">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold">
                Saved Code Snippets
              </h2>
              <p className="text-xs text-gray-400">
                {session.savedSnippets.length} snippet{session.savedSnippets.length !== 1 ? 's' : ''} saved during this session
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {session.savedSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="bg-gray-800 border-2 border-gray-700 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 bg-gray-700 border-b border-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-300 uppercase">
                      {snippet.language}
                    </span>
                    {snippet.topicTitle && (
                      <span className="text-xs text-gray-400">
                        from: {snippet.topicTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(snippet.savedAt).toLocaleString()}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(snippet.code);
                      }}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                      title="Copy code"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <pre className="p-3 font-mono text-sm text-green-400 overflow-x-auto">
                  <code>{snippet.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Source Snippets */}
      {session.knowledgeBase.sources.length > 0 && (
        <Card>
          <h2 className="font-heading text-xl font-bold text-text mb-4">
            Source Materials
          </h2>

          <div className="space-y-4">
            {session.knowledgeBase.sources.map((source, index) => (
              <div
                key={index}
                className="p-4 bg-surface border-2 border-border"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-heading font-semibold border border-border ${
                      source.type === 'github'
                        ? 'bg-success/20'
                        : source.type === 'documentation'
                        ? 'bg-secondary/20'
                        : 'bg-primary/20'
                    }`}
                  >
                    {source.type}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-heading font-semibold text-secondary hover:underline"
                  >
                    {source.title}
                  </a>
                </div>
                <p className="text-sm text-text/80 font-mono">
                  {source.snippet}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pb-8">
        <Button onClick={() => navigate('/')} size="lg">
          Start New Session
        </Button>
        <Button variant="ghost" onClick={() => navigate('/library')} size="lg">
          View Library
        </Button>
      </div>
    </div>
  );
}
