import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <h1 className="font-heading text-3xl font-bold text-text mb-6">
          Privacy Policy
        </h1>

        <p className="text-text/70 mb-8">
          Last updated: January 13, 2026
        </p>

        <div className="space-y-8 text-text">
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">1. Information We Collect</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              We collect information to provide and improve our Service:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Email address, name, and password when you register</li>
              <li><strong>Learning Data:</strong> Your answers, progress, bookmarks, and session history</li>
              <li><strong>Usage Data:</strong> How you interact with our Service, including features used and time spent</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and IP address</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">2. How We Use Your Information</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              We use collected information to:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li>Provide and maintain the Service</li>
              <li>Personalize your learning experience</li>
              <li>Generate AI-powered questions and feedback</li>
              <li>Implement spaced repetition for better retention</li>
              <li>Send important notifications about your account</li>
              <li>Improve and optimize our Service</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">3. Data Storage and Security</h2>
            <p className="text-text/80 leading-relaxed">
              Your data is stored securely using industry-standard encryption. We implement appropriate
              technical and organizational measures to protect your personal information against
              unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">4. Data Sharing</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third parties that help us operate our Service (payment processing, hosting)</li>
              <li><strong>AI Services:</strong> AI providers to generate questions and feedback (data is processed securely)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">5. Your Rights</h2>
            <p className="text-text/80 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-text/80 space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your learning data</li>
              <li>Opt-out of marketing communications</li>
            </ul>
            <p className="text-text/80 leading-relaxed mt-3">
              You can exercise these rights through your account settings or by contacting us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">6. Cookies and Tracking</h2>
            <p className="text-text/80 leading-relaxed">
              We use cookies and similar technologies to maintain your session, remember your preferences,
              and analyze usage patterns. You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">7. Children's Privacy</h2>
            <p className="text-text/80 leading-relaxed">
              Our Service is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If you believe we have collected such information,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">8. International Data Transfers</h2>
            <p className="text-text/80 leading-relaxed">
              Your information may be transferred to and processed in countries other than your own.
              We ensure appropriate safeguards are in place to protect your data in accordance with
              this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">9. Data Retention</h2>
            <p className="text-text/80 leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services.
              You can request deletion of your account and data at any time through Settings.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">10. Changes to This Policy</h2>
            <p className="text-text/80 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes via email or through the Service. Your continued use of the Service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold mb-3">11. Contact Us</h2>
            <p className="text-text/80 leading-relaxed">
              If you have questions about this Privacy Policy or your data, please contact us at{' '}
              <a href="mailto:privacy@teachy.app" className="text-primary hover:underline">
                privacy@teachy.app
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t-2 border-border">
          <Link to="/terms" className="text-primary hover:underline mr-4">
            Terms of Service
          </Link>
          <Link to="/" className="text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}
