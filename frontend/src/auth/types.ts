import type { AuthResponse, RoleDefinition, UserProfile } from '../api/types';

export interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  personas: string[];
  roles: Record<string, RoleDefinition>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
}
