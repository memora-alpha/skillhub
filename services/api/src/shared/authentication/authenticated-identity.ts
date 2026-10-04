// Auth owns verification and revocation before attaching this to a request.
export type AuthenticatedIdentity = {
  userId: string;
  sessionId: string;
};
