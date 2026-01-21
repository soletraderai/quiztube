import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface MigrationPromptProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCount: number;
  onMigrate: () => Promise<void>;
  onSkip: () => void;
}

export default function MigrationPrompt({
  isOpen,
  onClose,
  sessionCount,
  onMigrate,
  onSkip,
}: MigrationPromptProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setError(null);

    try {
      await onMigrate();
      setMigrationComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed. Please try again.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleComplete = () => {
    setMigrationComplete(false);
    onClose();
  };

  if (migrationComplete) {
    return (
      <Modal isOpen={isOpen} onClose={handleComplete}>
        <div className="p-6 text-center">
          {/* Success Checkmark */}
          <div className="w-16 h-16 mx-auto mb-4 bg-success/20 border-3 border-success rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="font-heading text-2xl font-bold text-text mb-2">
            Migration Complete!
          </h2>
          <p className="text-text/70 font-body mb-6">
            Your {sessionCount} learning {sessionCount === 1 ? 'lesson has' : 'lessons have'} been
            successfully migrated to your account. They will now sync across all your devices.
          </p>

          <Button onClick={handleComplete} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 border-3 border-primary rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-text"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="font-heading text-2xl font-bold text-text text-center mb-2">
          Migrate Your Learning Data
        </h2>

        {/* Description */}
        <p className="text-text/70 font-body text-center mb-6">
          We found <span className="font-bold text-text">{sessionCount} learning {sessionCount === 1 ? 'lesson' : 'lessons'}</span> stored
          on this device. Would you like to migrate them to your account?
        </p>

        {/* What will happen */}
        <div className="bg-background border-3 border-border p-4 mb-6">
          <h3 className="font-heading font-bold text-text mb-2">What will happen:</h3>
          <ul className="space-y-2 text-text/80 font-body text-sm">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Your lessons will be uploaded to your account</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Access your lessons from any device</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Your progress and bookmarks will be preserved</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Local data will be cleared after migration</span>
            </li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-error/10 border-3 border-error p-3 mb-4 text-error font-body text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isMigrating}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleMigrate}
            loading={isMigrating}
            disabled={isMigrating}
            className="flex-1"
          >
            {isMigrating ? 'Migrating...' : 'Migrate Data'}
          </Button>
        </div>

        {/* Skip note */}
        <p className="text-text/50 font-body text-xs text-center mt-4">
          If you skip, your local data will remain on this device but won't sync to your account.
        </p>
      </div>
    </Modal>
  );
}
