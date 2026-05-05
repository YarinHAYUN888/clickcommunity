import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
    if (!loading && authId) {
      navigate('/clicks', { replace: true });
    }
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
      <LandingFooter />
    </div>
  );
}