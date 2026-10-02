import { useState } from 'react';
import { useFlowStore } from '../../store/useFlowStore';

export default function AuthPage() {
  const { login } = useFlowStore();
  const [role, setRole] = useState<'customer' | 'staff' | 'admin'>('customer');
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(''); // For staff/admin email or ID

  // OTP State
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (role === 'customer' && !isLogin && !showOtp) {
      // Move to OTP screen for customer registration
      if (name && phone && password) {
        setShowOtp(true);
      }
      return;
    }

    if (role === 'customer' && !isLogin && showOtp) {
      // Verify OTP and login
      if (otp.length === 4) {
        login('customer');
      }
      return;
    }

    // Direct logins
    login(role);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{
      background: '#eef2f7',
    }}>
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-16 h-16 mx-auto flex items-center justify-center text-3xl mb-4"
            style={{
              background: '#1167f6',
              boxShadow: '0 8px 32px rgba(17, 103, 246, 0.3)',
              color: 'white',
              borderRadius: '20px'
            }}>
            ⚡
          </div>
          <h1 className="text-4xl font-black tracking-tight text-surface-800">FlowDesk</h1>
          <p className="text-surface-500 mt-2 font-medium">Beyond the Queue</p>
        </div>

        {/* Role Selector */}
        <div className="flex bg-surface-200 p-1 rounded-full mb-6 shadow-sm animate-fade-in-up">
          {(['customer', 'staff', 'admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => { setRole(r); setIsLogin(true); setShowOtp(false); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-full capitalize transition-all ${
                role === r ? 'bg-primary-500 text-white shadow' : 'text-surface-500 hover:text-surface-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Auth Card */}
        <div className="glass-card p-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          
          {/* Customer Login/Register Tabs */}
          {role === 'customer' && !showOtp && (
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 pb-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                  isLogin ? 'text-primary-600 border-primary-500' : 'text-surface-500 border-transparent hover:text-surface-800'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 pb-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                  !isLogin ? 'text-primary-600 border-primary-500' : 'text-surface-500 border-transparent hover:text-surface-800'
                }`}
              >
                Register
              </button>
            </div>
          )}
          
          {role !== 'customer' && (
            <h2 className="text-xl font-bold text-center text-surface-800 mb-6 pb-4 border-b border-surface-300">
              {role === 'staff' ? '👨‍💼 Staff Portal' : '📊 Admin Portal'}
            </h2>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* OTP Screen */}
            {showOtp ? (
              <div className="animate-fade-in-up text-center space-y-4">
                <p className="text-sm text-surface-600 mb-2">
                  We sent a code to <span className="font-bold text-primary-600">{phone}</span>
                </p>
                <div>
                  <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    maxLength={4}
                    className="input-field w-full text-center text-2xl tracking-[1em] py-4"
                    placeholder="••••"
                    required
                  />
                </div>
                <p className="text-xs text-surface-500 mt-2">Demo: Enter any 4 digits</p>
                <button type="submit" className="btn btn-primary w-full py-3.5 text-base shadow-[0_4px_14px_rgba(17,103,246,0.3)]">
                  Verify & Register
                </button>
                <button type="button" onClick={() => setShowOtp(false)} className="text-xs text-primary-600 hover:underline mt-4">
                  Go back
                </button>
              </div>
            ) : (
              /* Standard Forms */
              <>
                {role === 'customer' && !isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="input-field w-full text-base py-3"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                )}
                
                {role === 'customer' ? (
                  <div>
                    <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="input-field w-full text-base py-3"
                      placeholder="+1 (555) 000-0000"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                      {role === 'staff' ? 'Employee ID or Phone' : 'Admin Email'}
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      className="input-field w-full text-base py-3"
                      placeholder={role === 'staff' ? 'EMP-001' : 'admin@flowdesk.com'}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field w-full text-base py-3"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full py-3.5 text-base mt-2 shadow-[0_4px_14px_rgba(17,103,246,0.3)] hover:shadow-[0_6px_20px_rgba(17,103,246,0.4)]">
                  {role === 'customer' && !isLogin ? 'Send OTP' : 'Sign In'}
                </button>
              </>
            )}
          </form>
          
          {isLogin && !showOtp && (
            <div className="mt-6 text-center">
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                Forgot your password?
              </a>
            </div>
          )}
        </div>
        
        {/* Demo Footer */}
        <p className="text-center text-xs text-surface-500 mt-8 opacity-60 px-4">
          {role === 'customer' 
            ? 'Customers can register (with demo OTP) or login directly.' 
            : role === 'staff'
            ? 'Staff cannot self-register. Registration is handled by Admins via the Admin Dashboard.'
            : 'Admins cannot self-register. Registration is handled by the platform backend.'}
        </p>
      </div>
    </div>
  );
}
