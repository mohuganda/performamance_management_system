import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Card } from '../../components/atoms/Card';
import { LOGO_SVG } from '../../assets/logoSvg';
import { loginSchema } from '../../schemas/auth';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { getApiErrorMessage } from '../../api/client';
import { demoAccounts, DEMO_PASSWORD } from '../../constants/demoAccounts';
import { AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = t(err.message, { defaultValue: err.message });
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.requires_totp) {
        setServerError(t('login_totp_error', 'Two-factor authentication required.'));
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(err, t('login_failed_error', 'Failed to sign in. Please verify your credentials.')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 transition-colors"
      style={{ backgroundColor: colors.background }}
    >
      <div className="w-full max-w-md my-auto py-6">
        {/* Header MoH Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div
            className="w-20 h-20 mb-4 flex-shrink-0"
            dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
          />
          <h1 className="text-2xl font-bold text-center" style={{ color: colors.text }}>
            {t('pms_ihris', 'Performance Management System')}
          </h1>
          <p className="text-sm font-medium text-gray-500 text-center mt-1">
            Ministry of Health Uganda
          </p>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest mt-2">
            Saving Lives Livelihoods
          </span>
        </div>

        {/* Form Card */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-6" style={{ color: colors.text }}>
            {t('login_title', 'Sign In')}
          </h2>

          {serverError && (
            <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label={t('login_email_label', 'Email Address')}
              placeholder={t('login_email_placeholder', 'officer@health.go.ug')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            <Input
              label={t('login_password_label', 'Password')}
              placeholder={t('login_password_placeholder', '••••••••')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              title={t('login_button', 'Sign In')}
              loading={isLoading}
              className="mt-6"
            />
          </form>

          <div className="flex justify-center items-center mt-6 text-sm">
            <span className="text-gray-500 mr-1">{t('login_need_activate', 'Need to activate your account?')}</span>
            <span
              className="font-semibold cursor-pointer hover:underline"
              style={{ color: colors.primary }}
            >
              {t('login_activate_link', 'Activate here')}
            </span>
          </div>

          {/* Demo Accounts Section */}
          <div
            className="mt-6 pt-5 border-t text-center"
            style={{ borderTopColor: colors.border }}
          >
            <button
              type="button"
              onClick={() => setShowDemoAccounts((prev) => !prev)}
              className="text-sm font-medium hover:underline outline-none"
              style={{ color: colors.muted }}
            >
              {showDemoAccounts ? 'Hide demo accounts' : 'Show demo accounts for testing'}
            </button>

            {showDemoAccounts && (
              <div className="mt-4 flex flex-col space-y-2 text-left">
                {demoAccounts.map((account) => {
                  const isSelected = email === account.email;
                  return (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                        setShowDemoAccounts(false);
                      }}
                      className="border p-3 text-left transition-colors rounded-none"
                      style={{
                        backgroundColor: isSelected ? `${colors.primary}10` : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }}
                    >
                      <p className="text-sm font-bold" style={{ color: colors.text }}>
                        {account.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {account.description}
                      </p>
                      <p className="mt-2 font-mono text-[10px]" style={{ color: colors.muted }}>
                        {account.email}
                      </p>
                    </button>
                  );
                })}
                <p className="text-center text-xs mt-2" style={{ color: colors.muted }}>
                  Demo password:{' '}
                  <span className="font-mono font-bold" style={{ color: colors.text }}>
                    {DEMO_PASSWORD}
                  </span>
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
export default LoginScreen;
