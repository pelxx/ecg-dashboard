export const roles = ["master", "doctor", "nurse"] as const;

export type UserRole = (typeof roles)[number];

export type PermissionKey =
  | "manageUsers"
  | "createUsers"
  | "editUsers"
  | "deleteUsers"
  | "changeRoles"
  | "manageDevices"
  | "manageAssignments"
  | "viewDashboard"
  | "viewDevices"
  | "viewECG"
  | "recordECG"
  | "saveSnapshot"
  | "viewRecordingHistory"
  | "downloadRecordings"
  | "deleteRecordings"
  | "viewReports";

export type PermissionSet = Record<PermissionKey, boolean>;

const doctorPermissions: PermissionSet = {
  manageUsers: false,
  createUsers: false,
  editUsers: false,
  deleteUsers: false,
  changeRoles: false,
  manageDevices: false,
  manageAssignments: false,
  viewDashboard: true,
  viewDevices: true,
  viewECG: true,
  recordECG: true,
  saveSnapshot: true,
  viewRecordingHistory: true,
  downloadRecordings: true,
  deleteRecordings: false,
  viewReports: true,
};

export const permissions: Record<UserRole, PermissionSet> = {
  master: {
    manageUsers: true,
    createUsers: true,
    editUsers: true,
    deleteUsers: true,
    changeRoles: true,
    manageDevices: true,
    manageAssignments: true,
    viewDashboard: true,
    viewDevices: true,
    viewECG: true,
    recordECG: true,
    saveSnapshot: true,
    viewRecordingHistory: true,
    downloadRecordings: true,
    deleteRecordings: true,
    viewReports: true,
  },
  doctor: doctorPermissions,
  nurse: {
    ...doctorPermissions,
    manageAssignments: true,
    viewReports: false,
  },
};

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && roles.includes(value as UserRole);

export const getPermissions = (role: UserRole | null): PermissionSet | null =>
  role ? permissions[role] : null;

export const hasPermission = (
  role: UserRole | null,
  permission: PermissionKey
): boolean => getPermissions(role)?.[permission] ?? false;

export type NavigationItem = {
  href: string;
  label: string;
  permission: PermissionKey;
};

export const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", permission: "viewDashboard" },
  { href: "/devices", label: "Devices", permission: "viewDevices" },
  { href: "/users", label: "Users", permission: "manageUsers" },
  { href: "/reports", label: "Reports", permission: "viewReports" },
];
