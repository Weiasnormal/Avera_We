// Endpoint map copied from the mobile app (src/constants/api.ts and adminApi.ts).
// Paths are relative to the backend root; services/api/client.ts sends them
// through the same-origin proxy at /api/backend.

export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    profile: "/auth/me",
    profilePicture: "/auth/me/profile-picture",
    register: "/auth/register",
    logout: "/auth/logout",
    changePassword: "/auth/change-password",
    changeEmail: "/auth/change-email",
    changeName: "/auth/change-name",
    resendVerificationEmail: "/auth/resend-verification-email",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    verifyEmail: "/auth/verify-email",
    verifyResetCode: "/auth/password/verify-code",
    emailVerificationStatus: "/auth/email-verification-status",
    joinInviteCode: "/auth/join-invite-code",
    deleteAccount: "/auth/delete",
  },
  cases: {
    list: "/cases",
    create: "/cases",
    get: (caseId: string) => `/cases/${caseId}`,
    updateStatus: (caseId: string) => `/cases/${caseId}/status`,
    review: (caseId: string) => `/cases/${caseId}/review`,
    viewed: (caseId: string) => `/cases/${caseId}/viewed`,
    toggleInternalReviewFlag: (caseId: string) => `/cases/${caseId}/flag`,
  },
  signatures: {
    uploadReference: (caseId: string) => `/cases/${caseId}/signatures/reference`,
    uploadSuspected: (caseId: string) => `/cases/${caseId}/signatures/suspected`,
    getReference: (caseId: string, index: number) => `/cases/${caseId}/signatures/reference/${index}`,
    getSuspected: (caseId: string, index: number) => `/cases/${caseId}/signatures/suspected/${index}`,
  },
  analysis: {
    start: (caseId: string) => `/cases/${caseId}/analysis`,
    getResults: (caseId: string) => `/cases/${caseId}/results`,
  },
  ml: {
    getBlobImage: (caseId: string, imageId: string) => `/cases/${caseId}/images/${imageId}`,
  },
  notifications: {
    list: "/notifications/",
    markAsRead: (notificationId: string) => `/notifications/${notificationId}/read`,
    markAllAsRead: "/notifications/read-all",
  },
  hub: "/hubs/notification",
} as const;

export const ADMIN_API_ENDPOINTS = {
  team: {
    list: "/tenant/members",
    getById: (id: string) => `/tenant/members/${id}`,
    remove: (id: string) => `/tenant/members/${id}`,
  },
  memberRequests: {
    pending: "/tenants/member-requests/pending",
    approve: (requestId: string) => `/tenants/member-requests/${requestId}/approve`,
    reject: (requestId: string) => `/tenants/member-requests/${requestId}/reject`,
  },
  tenant: {
    create: "/tenants",
    rename: "/tenants/rename",
    suspendUser: "/admin/suspend-user",
    unsuspendUser: "/admin/unsuspend-user",
    setDailyLimit: "/admin/set-user-daily-limit",
    setMemberCountLimit: "/admin/set-member-count-limit",
    inviteCode: "/tenant/invite-code",
    profile: "/tenant/profile",
  },
} as const;
