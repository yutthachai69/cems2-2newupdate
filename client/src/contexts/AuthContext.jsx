import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // กำหนด password สำหรับแต่ละ role
  const rolePasswords = {
    admin: 'admin123',
    user: 'user123'
  };

  // ตรวจสอบ role และ password
  const login = (role, password) => {
    if (rolePasswords[role] === password) {
      const userData = {
        role: role,
        name: role === 'admin' ? 'Administrator' : 'User',
        permissions: getPermissions(role)
      };
      
      setUser(userData);
      localStorage.setItem('cems_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  };

  // กำหนด permissions ตาม role
  const getPermissions = (role) => {
    switch (role) {
      case 'admin':
        return {
          canAccessHome: true,
          canAccessGraph: true,
          canAccessDataLogs: true,
          canAccessConfig: true,
          canAccessStatus: true,
          canAccessMapping: true,
          canModifySettings: true
        };
      case 'user':
        return {
          canAccessHome: true,
          canAccessGraph: true,
          canAccessDataLogs: true,
          canAccessConfig: false,
          canAccessStatus: false,
          canAccessMapping: false,
          canModifySettings: false
        };
      default:
        return {};
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem('cems_user');
  };

  // ตรวจสอบ user จาก localStorage เมื่อ component mount
  useEffect(() => {
    const savedUser = localStorage.getItem('cems_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('cems_user');
      }
    }
    setLoading(false);
  }, []);

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isUser: user?.role === 'user'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
