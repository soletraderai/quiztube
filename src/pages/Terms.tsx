import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <h1 className="font-heading text-3xl font-bold text-text mb-6">
          Terms of Service
        </h1>

        <p className="text-text/70 mb-8">
          Last updated: January 13, 2026
        </p>

        <div className="space-y-8 text-text">
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">1. Acceptance of Terms</h2>
            <p className="text-text/80 leading-relaxed">
              By accessing or using Teachy ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">2. Description of Service</h2>
            <p className="text-text/80 leading-relaxed">
              Teachy is an educational platform that transforms YouTube videos into interactive learning
              sessions. We use AI to generate questions, provide feedback, and help you learn more
              effectively from video content.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">3. User Accounts</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              To access certain features, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">4. Subscription and Payments</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              Teachy offers both free and paid subscription tiers:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li><strong>Free tier:</strong> Limited sessions per month with basic features</li>
              <li><strong>Pro tier:</strong> Unlimited sessions, advanced features, and priority support</li>
            </ul>
            <p className="text-text/80 leading-relaxed mt-3">
              Subscriptions are billed monthly or annually. You can cancel anytime through your account settings.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">5. Acceptable Use</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to bypass any security measures</li>
              <li>Interfere with other users' enjoyment of the Service</li>
              <li>Upload malicious code or attempt to hack the platform</li>
              <li>Use automated systems to access the Service without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">6. Intellectual Property</h2>
            <p className="text-text/80 leading-relaxed">
              The Service and its original content, features, and functionality are owned by Teachy and
              are protected by international copyright, trademark, and other intellectual property laws.
              Your learning data and personal notes remain your property.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">7. Third-Party Content</h2>
            <p className="text-text/80 leading-relaxed">
              Teachy processes YouTube videos which are owned by their respective creators. We do not
              claim ownership of video content. Our Service helps you learn from publicly available
              videos in compliance with YouTube's Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">8. Limitation of Liability</h2>
            <p className="text-text/80 leading-relaxed">
              The Service is provided "as is" without warranties of any kind. We are not liable for any
              indirect, incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">9. Changes to Terms</h2>
            <p className="text-text/80 leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of significant
              changes via email or through the Service. Continued use after changes constitutes acceptance
              of the new terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">10. Contact Us</h2>
            <p className="text-text/80 leading-relaxed">
              If you have questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@teachy.app" className="text-primary hover:underline">
                support@teachy.app
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t-2 border-border">
          <Link to="/privacy" className="text-primary hover:underline mr-4">
            Privacy Policy
          </Link>
          <Link to="/" className="text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}
