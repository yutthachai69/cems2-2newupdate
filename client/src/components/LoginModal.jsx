import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginModal({ isOpen, onClose }) {
  const [selectedRole, setSelectedRole] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!selectedRole) {
      setError('กรุณาเลือก Role');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('กรุณาใส่รหัสผ่าน');
      setLoading(false);
      return;
    }

    const result = login(selectedRole, password);
    
    if (result.success) {
      onClose();
      setSelectedRole('');
      setPassword('');
      setError('');
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleClose = () => {
    setSelectedRole('');
    setPassword('');
    setError('');
    onClose();
  };

  const roleOptions = [
    { value: 'admin', label: 'Administrator', description: 'เข้าถึงได้ทุกหน้าและสามารถแก้ไขการตั้งค่าได้' },
    { value: 'user', label: 'User', description: 'เข้าถึงได้เฉพาะหน้า Home, Graph และ DataLogs' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Modal Content */}
          <div className="bg-white rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">เข้าสู่ระบบ</h2>
                  <p className="text-sm text-gray-600">CEMS System</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  เลือก Role
                </label>
                <div className="space-y-3">
                  {roleOptions.map((role) => (
                    <div
                      key={role.value}
                      className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedRole === role.value
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedRole(role.value)}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={selectedRole === role.value}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {role.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {role.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  รหัสผ่าน
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ใส่รหัสผ่าน"
                  disabled={loading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedRole}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>

            {/* Password Info */}
            <div className="px-6 pb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">รหัสผ่านเริ่มต้น:</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>• Administrator: <code className="bg-gray-200 px-1 rounded">admin123</code></div>
                  <div>• User: <code className="bg-gray-200 px-1 rounded">user123</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
