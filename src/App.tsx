import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ResponsiveShell from "@/components/ui/ResponsiveShell";
import MainLayout from "@/layouts/MainLayout";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { LumaSpin } from "@/components/ui/luma-spin";

import WelcomePage from "./pages/WelcomePage";
import LandingPage from "./pages/LandingPage";
import ReferCaptureRedirect from "./pages/ReferCaptureRedirect";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import ClicksPage from "./pages/ClicksPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventVotePage from "./pages/EventVotePage";
import MemberEventFormPage from "./pages/MemberEventFormPage";
import ChatsPage from "./pages/ChatsPage";
import ChatConversationPage from "./pages/ChatConversationPage";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import SubscriptionPage from "./pages/SubscriptionPage";
import NotFound from "./pages/NotFound";
import PendingReviewPage from "./pages/PendingReviewPage";
import BlockedPage from "./pages/BlockedPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import EventsAccessGate from "@/components/guards/EventsAccessGate";
import SuitabilityGate from "@/components/guards/SuitabilityGate";
import AdminRoute from "@/components/guards/AdminRoute";

// Admin pages — lazy to keep first paint / tab switches lighter for members
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminEventsPage = lazy(() => import("./pages/admin/AdminEventsPage"));
const AdminEventDetailPage = lazy(() => import("./pages/admin/AdminEventDetailPage"));
const AdminEventParticipantsPage = lazy(() => import("./pages/admin/AdminEventParticipantsPage"));
const AdminEventFormPage = lazy(() => import("./pages/admin/AdminEventFormPage"));
const AdminChatsPage = lazy(() => import("./pages/admin/AdminChatsPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage"));
const AdminAutomationPage = lazy(() => import("./pages/admin/AdminAutomationPage"));
const AdminCommunityPage = lazy(() => import("./pages/admin/AdminCommunityPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminLazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <LumaSpin size={40} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OnboardingProvider>
        <CurrentUserProvider>
        <AdminProvider>
          <BrowserRouter>
            <Routes>
              {/* Landing — full-bleed, no shell */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/r/:code" element={<ReferCaptureRedirect />} />

              {/* Single flat tree: avoids nested <Routes> under path="*" (can yield blank matches). */}
              <Route element={<ResponsiveShell />}>
                <Route path="/welcome" element={<WelcomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/onboarding/verify"
                  element={<Navigate to="/onboarding/account-verification" replace />}
                />
                <Route path="/onboarding/:step" element={<OnboardingPage />} />

                <Route path="/pending-review" element={<PendingReviewPage />} />
                <Route path="/blocked" element={<BlockedPage />} />
                <Route path="/complete-profile" element={<CompleteProfilePage />} />

                <Route element={<SuitabilityGate />}>
                  <Route element={<MainLayout />}>
                    <Route path="/clicks" element={<ClicksPage />} />
                    <Route path="/events/create" element={<MemberEventFormPage />} />
                    <Route element={<EventsAccessGate />}>
                      <Route path="/events" element={<EventsPage />} />
                      <Route path="/events/:eventId" element={<EventDetailPage />} />
                      <Route path="/events/:eventId/vote" element={<EventVotePage />} />
                    </Route>
                    <Route path="/chats" element={<ChatsPage />} />
                    <Route path="/chats/:chatId" element={<ChatConversationPage />} />
                    <Route path="/profile/edit" element={<EditProfilePage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    {/* Avoid `/profile/:userId` — it can match `/profile/edit` (userId = "edit") and break the edit screen. */}
                    <Route path="/profile/user/:userId" element={<ProfilePage />} />
                    <Route path="/subscription" element={<SubscriptionPage />} />

                    {/* Admin — super users only (lazy chunks) */}
                    <Route element={<AdminRoute />}>
                      <Route path="/admin" element={<AdminLazy><AdminDashboardPage /></AdminLazy>} />
                      <Route path="/admin/users" element={<AdminLazy><AdminUsersPage /></AdminLazy>} />
                      <Route path="/admin/events" element={<AdminLazy><AdminEventsPage /></AdminLazy>} />
                      <Route path="/admin/events/new" element={<AdminLazy><AdminEventFormPage /></AdminLazy>} />
                      <Route path="/admin/events/:eventId" element={<AdminLazy><AdminEventDetailPage /></AdminLazy>} />
                      <Route path="/admin/events/:eventId/participants" element={<AdminLazy><AdminEventParticipantsPage /></AdminLazy>} />
                      <Route path="/admin/events/:eventId/edit" element={<AdminLazy><AdminEventFormPage /></AdminLazy>} />
                      <Route path="/admin/chats" element={<AdminLazy><AdminChatsPage /></AdminLazy>} />
                      <Route path="/admin/subscriptions" element={<AdminLazy><AdminSubscriptionsPage /></AdminLazy>} />
                      <Route path="/admin/automation" element={<AdminLazy><AdminAutomationPage /></AdminLazy>} />
                      <Route path="/admin/community" element={<AdminLazy><AdminCommunityPage /></AdminLazy>} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AdminProvider>
        </CurrentUserProvider>
      </OnboardingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
