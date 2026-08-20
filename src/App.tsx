import { Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ChangePassword from "./pages/AuthPages/ChangePassword";
import {
  ActivityListPage,
  ActivityFormPage,
  ActivityDetailPage,
} from "./pages/Activities/ActivitiesPages";
import { ApprovalsPage, MyTeamPage } from "./pages/Activities/ApprovalsPages";
import ReportsPage from "./pages/Reports/ReportsPage";
import {
  UsersAdminPage,
  DivisionsAdminPage,
  PositionsAdminPage,
  AuditLogPage,
} from "./pages/Admin/AdminPages";
import {
  CmsNewsPage,
  CmsPagesPage,
  CmsInstitutionsPage,
  CmsContactsPage,
} from "./pages/Cms/CmsPages";
import {
  PublicLayout,
  PublicHomePage,
  PublicAboutPage,
  PublicNewsListPage,
  PublicNewsDetailPage,
  PublicDocumentsPage,
  PublicInstitutionsPage,
  PublicContactPage,
} from "./pages/Public/PublicPages";
import ActivityCalendarPage from "./pages/Activities/ActivityCalendarPage";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index path="/" element={<Home />} />
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route path="/activities" element={<ActivityListPage />} />
          <Route path="/activities/new" element={<ActivityFormPage />} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />
          <Route path="/activities/:id/edit" element={<ActivityFormPage />} />
          <Route path="/calendar" element={<ActivityCalendarPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/team" element={<MyTeamPage />} />
          <Route path="/reports" element={<ReportsPage />} />

          <Route path="/admin/users" element={<UsersAdminPage />} />
          <Route path="/admin/divisions" element={<DivisionsAdminPage />} />
          <Route path="/admin/positions" element={<PositionsAdminPage />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />

          <Route path="/cms/news" element={<CmsNewsPage />} />
          <Route path="/cms/pages" element={<CmsPagesPage />} />
          <Route path="/cms/institutions" element={<CmsInstitutionsPage />} />
          <Route path="/cms/contacts" element={<CmsContactsPage />} />
        </Route>

        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<Navigate to="/signin" replace />} />

        <Route path="/p/:locale" element={<PublicLayout />}>
          <Route index element={<PublicHomePage />} />
          <Route path="about" element={<PublicAboutPage />} />
          <Route path="news" element={<PublicNewsListPage />} />
          <Route path="news/:slug" element={<PublicNewsDetailPage />} />
          <Route path="documents" element={<PublicDocumentsPage />} />
          <Route path="institutions" element={<PublicInstitutionsPage />} />
          <Route path="contact" element={<PublicContactPage />} />
        </Route>
        <Route path="/p" element={<Navigate to="/p/lo" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
