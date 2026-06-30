import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getAuthenticatedEntryRoute } from '@/lib/routing/resolveAuthenticatedEntry';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import StatsStrip from '@/components/landing/StatsStrip';
import WhoWeAreSection from '@/components/landing/WhoWeAreSection';
import ConceptSection from '@/components/landing/ConceptSection';
import ImpactSection from '@/components/landing/ImpactSection';
import ForWhomSection from '@/components/landing/ForWhomSection';
import TestimonialsShowcase from '@/components/landing/TestimonialsShowcase';
import SubscriptionSection from '@/components/landing/SubscriptionSection';
import BottomLineSection from '@/components/landing/BottomLineSection';
import SocialSection from '@/components/landing/SocialSection';
import MomentsSection from '@/components/landing/MomentsSection';
import LandingFooter from '@/components/landing/LandingFooter';
import ScrollProgressBar from '@/components/landing/ScrollProgressBar';
import SectionIndicators from '@/components/landing/SectionIndicators';
import HaydevPoweredCard from '@/components/haydev/HaydevPoweredCard';
import HaydevLogo from '@/components/haydev/HaydevLogo';
import { HAYDEV_WHATSAPP_LINK } from '@/config/haydevBranding';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authId, loading } = useCurrentUser();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref?.trim()) {
      try {
        localStorage.setItem('clicks_ref_code', ref.trim());
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || !authId) return;
    let cancelled = false;
    void getAuthenticatedEntryRoute(authId).then((route) => {
      if (!cancelled) navigate(route, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, authId, navigate]);

  return (
    <div data-landing="true" className="min-h-screen w-full bg-background overflow-x-hidden" dir="rtl">
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        דלג לתוכן
      </a>
      <ScrollProgressBar />
      <SectionIndicators />
      <LandingHeader />
      <main>
        <HeroSection />
        <StatsStrip />
        <WhoWeAreSection />
        <ConceptSection />
        <ImpactSection />
        <ForWhomSection />
        <TestimonialsShowcase />
        <SubscriptionSection />
        <MomentsSection />
        <BottomLineSection />
        <SocialSection />
      </main>
      <section
        aria-label="Powered by HAYDEV"
        className="px-6 py-16 md:py-20"
        style={{ background: 'linear-gradient(180deg, #08080F 0%, #0F0F1A 50%, #08080F 100%)' }}
      >
        <div className="max-w-[640px] mx-auto">
          <HaydevPoweredCard
            variant="landing"
            logo={<HaydevLogo className="h-12 sm:h-14 md:h-16" />}
            title="האפליקציה פותחה באמצעות HAYDEV"
            subtitle="פיתוח אפליקציות • מערכות SaaS • אוטומציות • AI"
            buttonText="💬 דברו איתנו ב-WhatsApp"
            whatsappLink={HAYDEV_WHATSAPP_LINK}
          />
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}