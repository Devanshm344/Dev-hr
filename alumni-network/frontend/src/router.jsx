import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout";
import { PortalLayout } from "@/components/portal-layout";
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PortalDashboard = lazy(() => import("@/pages/portal/Dashboard"));
const PortalBenefits = lazy(() => import("@/pages/portal/Benefits"));
const PortalDocuments = lazy(() => import("@/pages/portal/Documents"));
const PortalEvents = lazy(() => import("@/pages/portal/Events"));
const PortalFeedback = lazy(() => import("@/pages/portal/Feedback"));
const PortalForumIndex = lazy(() => import("@/pages/portal/forum/ForumIndex"));
const PortalForumPost = lazy(() => import("@/pages/portal/forum/ForumPost"));
const PortalMessages = lazy(() => import("@/pages/portal/Messages"));
const PortalNetworking = lazy(() => import("@/pages/portal/Networking"));
const PortalNotifications = lazy(() => import("@/pages/portal/Notifications"));
const PortalProfile = lazy(() => import("@/pages/portal/Profile"));
const PortalRequests = lazy(() => import("@/pages/portal/Requests"));
const PortalRequestDetail = lazy(() => import("@/pages/portal/RequestDetail"));
const PortalSettings = lazy(() => import("@/pages/portal/Settings"));
const PortalStories = lazy(() => import("@/pages/portal/Stories"));
const HRDashboard = lazy(() => import("@/pages/hr/Dashboard"));
const HRAlumni = lazy(() => import("@/pages/hr/Alumni"));
const HRAnnouncements = lazy(() => import("@/pages/hr/Announcements"));
const HRBenefits = lazy(() => import("@/pages/hr/Benefits"));
const HREvents = lazy(() => import("@/pages/hr/Events"));
const HRFeedback = lazy(() => import("@/pages/hr/Feedback"));
const HRNetworking = lazy(() => import("@/pages/hr/Networking"));
const HRNotifications = lazy(() => import("@/pages/hr/Notifications"));
const HRMessages = lazy(() => import("@/pages/hr/Messages"));
const HRRegistrations = lazy(() => import("@/pages/hr/Registrations"));
const HRReports = lazy(() => import("@/pages/hr/Reports"));
const HRRequests = lazy(() => import("@/pages/hr/Requests"));
const HRRequestDetail = lazy(() => import("@/pages/hr/RequestDetail"));
const HRSalaryCertificates = lazy(() => import("@/pages/hr/SalaryCertificates"));
const HRSettings = lazy(() => import("@/pages/hr/Settings"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminAlumni = lazy(() => import("@/pages/admin/Alumni"));
const AdminAudit = lazy(() => import("@/pages/admin/Audit"));
const AdminBenefits = lazy(() => import("@/pages/admin/Benefits"));
const AdminCms = lazy(() => import("@/pages/admin/Cms"));
const AdminEvents = lazy(() => import("@/pages/admin/Events"));
const AdminHrUsers = lazy(() => import("@/pages/admin/HrUsers"));
const AdminInquiries = lazy(() => import("@/pages/admin/Inquiries"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));
const AdminReports = lazy(() => import("@/pages/admin/Reports"));
const AdminRoles = lazy(() => import("@/pages/admin/Roles"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminStories = lazy(() => import("@/pages/admin/Stories"));
function PageSpinner() {
  return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>;
}
function withSuspense(element) {
  return <Suspense fallback={<PageSpinner />}>{element}</Suspense>;
}
export const router = createBrowserRouter([{
  element: <RootLayout />,
  children: [{
    index: true,
    element: withSuspense(<Landing />)
  }, {
    path: "login",
    element: withSuspense(<Login />)
  }, {
    path: "register",
    element: withSuspense(<Register />)
  }, {
    path: "forgot-password",
    element: withSuspense(<ForgotPassword />)
  }, {
    path: "reset-password",
    element: withSuspense(<ResetPassword />)
  }, {
    path: "portal",
    element: <PortalLayout portal="alumni" />,
    children: [{
      path: "dashboard",
      element: withSuspense(<PortalDashboard />)
    }, {
      path: "benefits",
      element: withSuspense(<PortalBenefits />)
    }, {
      path: "documents",
      element: withSuspense(<PortalDocuments />)
    }, {
      path: "events",
      element: withSuspense(<PortalEvents />)
    }, {
      path: "feedback",
      element: withSuspense(<PortalFeedback />)
    }, {
      path: "forum",
      element: withSuspense(<PortalForumIndex />)
    }, {
      path: "forum/:id",
      element: withSuspense(<PortalForumPost />)
    }, {
      path: "messages",
      element: withSuspense(<PortalMessages />)
    }, {
      path: "networking",
      element: withSuspense(<PortalNetworking />)
    }, {
      path: "notifications",
      element: withSuspense(<PortalNotifications />)
    }, {
      path: "profile",
      element: withSuspense(<PortalProfile />)
    }, {
      path: "requests",
      element: withSuspense(<PortalRequests />)
    }, {
      path: "requests/:id",
      element: withSuspense(<PortalRequestDetail />)
    }, {
      path: "settings",
      element: withSuspense(<PortalSettings />)
    }, {
      path: "stories",
      element: withSuspense(<PortalStories />)
    }]
  }, {
    path: "hr",
    element: <PortalLayout portal="hr" />,
    children: [{
      path: "dashboard",
      element: withSuspense(<HRDashboard />)
    }, {
      path: "alumni",
      element: withSuspense(<HRAlumni />)
    }, {
      path: "announcements",
      element: withSuspense(<HRAnnouncements />)
    }, {
      path: "benefits",
      element: withSuspense(<HRBenefits />)
    }, {
      path: "events",
      element: withSuspense(<HREvents />)
    }, {
      path: "feedback",
      element: withSuspense(<HRFeedback />)
    }, {
      path: "networking",
      element: withSuspense(<HRNetworking />)
    }, {
      path: "notifications",
      element: withSuspense(<HRNotifications />)
    }, {
      path: "registrations",
      element: withSuspense(<HRRegistrations />)
    }, {
      path: "reports",
      element: withSuspense(<HRReports />)
    }, {
      path: "requests",
      element: withSuspense(<HRRequests />)
    }, {
      path: "requests/:id",
      element: withSuspense(<HRRequestDetail />)
    }, {
      path: "messages",
      element: withSuspense(<HRMessages />)
    }, {
      path: "salary-certificates",
      element: withSuspense(<HRSalaryCertificates />)
    }, {
      path: "settings",
      element: withSuspense(<HRSettings />)
    }]
  }, {
    path: "admin",
    element: <PortalLayout portal="admin" />,
    children: [{
      path: "dashboard",
      element: withSuspense(<AdminDashboard />)
    }, {
      path: "alumni",
      element: withSuspense(<AdminAlumni />)
    }, {
      path: "audit",
      element: withSuspense(<AdminAudit />)
    }, {
      path: "benefits",
      element: withSuspense(<AdminBenefits />)
    }, {
      path: "cms",
      element: withSuspense(<AdminCms />)
    }, {
      path: "events",
      element: withSuspense(<AdminEvents />)
    }, {
      path: "hr-users",
      element: withSuspense(<AdminHrUsers />)
    }, {
      path: "inquiries",
      element: withSuspense(<AdminInquiries />)
    }, {
      path: "notifications",
      element: withSuspense(<AdminNotifications />)
    }, {
      path: "reports",
      element: withSuspense(<AdminReports />)
    }, {
      path: "roles",
      element: withSuspense(<AdminRoles />)
    }, {
      path: "settings",
      element: withSuspense(<AdminSettings />)
    }, {
      path: "stories",
      element: withSuspense(<AdminStories />)
    }]
  }, {
    path: "*",
    element: withSuspense(<NotFound />)
  }]
}]);
