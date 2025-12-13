import { type UserRole } from '../context/AuthContext';

export function landingPathForRole(role?: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'instructor':
      return '/instructor';
    default:
      return '/player';
  }
}
