export type AuthenticatedAdmin = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "invited" | "suspended" | "disabled";
};

export type LoginResult = {
  admin: AuthenticatedAdmin;
  sessionToken: string;
  expiresAt: Date;
};
