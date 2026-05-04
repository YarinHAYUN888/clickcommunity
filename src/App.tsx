import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ResponsiveShell from "@/components/ui/ResponsiveShell";
import MainLayout from "@/layouts/MainLayout";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { AdminProvider } from "@/contexts/AdminContext";

import WelcomePage from "./pages/WelcomePage";
import LandingPage from "./pages/LandingPage";
import ReferCaptureRedirect from "./pages/ReferCaptureRedirect";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import ClicksPage from "./pages/ClicksPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventVotePage from "./pages/EventVotePage";
import ChatsPage from "./pages/ChatsPage";
import ChatConversationPage from "./pages/ChatConversationPage";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import SubscriptionPage from "./pages/SubscriptionPage";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminEventsPage from "./pages/admin/AdminEventsPage";
import AdminEventDetailPage from "./pages/admin/AdminEventDetailPage";
import AdminEventFormPage from "./pages/admin/AdminEventFormPage";
import AdminChatsPage from "./pages/admin/AdminChatsPage";
import AdminSubscriptionsPage from "./pages/admin/AdminSubscriptionsPage";
import PendingReviewPage from "./pages/PendingReviewPage";
import BlockedPage from "./pages/BlockedPage";
import SuitabilityGate from "@/components/guards/SuitabilityGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OnboardingProvider>
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

                <Route element={<SuitabilityGate />}>
                  <Route element={<MainLayout />}>
                    <Route path="/clicks" element={<ClicksPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/events/:eventId" element={<EventDetailPage />} />
                    <Route path="/events/:eventId/vote" element={<EventVotePage />} />
                    <Route path="/chats" element={<ChatsPage />} />
                    <Route path="/chats/:chatId" element={<ChatConversationPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/edit" element={<EditProfilePage />} />
                    <Route path="/profile/:userId" element={<ProfilePage />} />
                    <Route path="/subscription" element={<SubscriptionPage />} />

                    {/* Admin — inside MainLayout for tab bar */}
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    <Route path="/admin/events" element={<AdminEventsPage />} />
                    <Route path="/admin/events/new" element={<AdminEventFormPage />} />
                    <Route path="/admin/events/:eventId" element={<AdminEventDetailPage />} />
                    <Route path="/admin/events/:eventId/edit" element={<AdminEventFormPage />} />
                    <Route path="/admin/chats" element={<AdminChatsPage />} />
                    <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AdminProvider>
      </OnboardingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
