import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { demoProfiles, initialPermissions } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  userPermissions: string[];
  hasPermission: (permissionCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
  loginAsDemoUser: (profileId: string) => void;
  loginWithCredentials: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  demoUsers: UserProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to resolve permissions for a profile
function getPermissionsForProfile(profile: UserProfile | null): string[] {
  if (!profile) return [];
  if (profile.role === 'super_admin') {
    return initialPermissions.map((p) => p.code);
  }
  if (profile.role === 'tenant_admin') {
    return initialPermissions.filter((p) => !p.code.startsWith('tenant.create')).map((p) => p.code);
  }
  if (profile.role === 'collection_agent') {
    return [
      'tenant.view',
      'organization.view',
      'suborganization.view',
      'client.view',
      'item.view',
      'request.view',
      'request.create',
      'request.edit',
      'request.submit',
      'collection.view',
      'collection.create',
      'collection.edit',
    ];
  }
  if (profile.role === 'org_admin') {
    return [
      'tenant.view',
      'organization.view', 'organization.edit',
      'suborganization.view', 'suborganization.create', 'suborganization.edit',
      'user.view', 'user.create', 'user.edit', 'user.status',
      'role.view', 'permission.view', 'audit.view',
      'client.view', 'client.create', 'client.edit',
      'vendor.view', 'vendor.create', 'vendor.edit',
      'item.view', 'item.create', 'item.edit',
      'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit', 'request.override_availability',
      'collection.view', 'collection.create', 'collection.edit',
    ];
  }
  return [
    'tenant.view', 'organization.view', 'suborganization.view',
    'user.view', 'role.view', 'permission.view',
    'client.view', 'vendor.view', 'item.view', 'request.view', 'collection.view'
  ];
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('ccm_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return demoProfiles[0];
      }
    }
    return demoProfiles[0];
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ccm_user_profile', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ccm_user_profile');
    }
  }, [currentUser]);

  // Check Supabase session if configured
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    const checkSession = async () => {
      const { data } = await client.auth.getSession();
      if (data.session?.user) {
        const { data: profile } = await client
          .from('user_profiles')
          .select('*, organization:organizations(id, name, code), sub_organization:sub_organizations(id, name, code)')
          .eq('id', data.session.user.id)
          .single();

        if (profile) {
          setCurrentUser(profile);
        }
      }
    };

    checkSession();

    const { data: authListener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await client
          .from('user_profiles')
          .select('*, organization:organizations(id, name, code), sub_organization:sub_organizations(id, name, code)')
          .eq('id', session.user.id)
          .single();
        if (profile) setCurrentUser(profile);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginAsDemoUser = (profileId: string) => {
    setIsLoading(true);
    const target = demoProfiles.find((p) => p.id === profileId) || demoProfiles[0];
    setCurrentUser(target);
    setIsLoading(false);
  };

  const loginWithCredentials = async (email: string, password = 'Password123!'): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*, organization:organizations(id, name, code), sub_organization:sub_organizations(id, name, code)')
            .eq('id', data.user.id)
            .single();
          if (profile) setCurrentUser(profile);
          setIsLoading(false);
          return true;
        }
      }

      // Demo fallback check
      const matched = demoProfiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        setCurrentUser(matched);
        setIsLoading(false);
        return true;
      }

      const genericUser: UserProfile = {
        id: 'usr-' + Math.random().toString(36).substring(2, 8),
        tenant_id: '11111111-1111-4111-a111-111111111111',
        full_name: email.split('@')[0],
        email: email,
        phone: '+1 (555) 000-0000',
        role: 'tenant_admin' as UserRole,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrentUser(genericUser);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
    setCurrentUser(null);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const userPermissions = getPermissionsForProfile(currentUser);

  const hasPermission = (permissionCode: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    return userPermissions.includes(permissionCode);
  };

  const hasRole = (roleCode: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === roleCode) return true;
    return currentUser.roles?.some((r) => r.code === roleCode) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        isSuperAdmin,
        userPermissions,
        hasPermission,
        hasRole,
        loginAsDemoUser,
        loginWithCredentials,
        logout,
        demoUsers: demoProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
