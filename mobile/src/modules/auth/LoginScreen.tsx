import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../app/navigation/types';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Card } from '../../components/atoms/Card';
import { FormStatusAlert } from '../../components/molecules/FormStatusAlert';
import { AuthTemplate } from '../../components/templates';
import { loginSchema } from '../../app/schemas/auth';
import { useLoginMutation } from '../../app/hooks/useAuthMutations';
import { useTheme } from '../../app/hooks/useTheme';
import { LOGO_SVG } from '../../assets/logoSvg';
import { demoAccounts, DEMO_PASSWORD } from '../../constants/demoAccounts';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const handleLogin = async () => {
    setServerError(null);
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = t(err.message);
        }
      });
      setErrors(fieldErrors);
      return;
    }

    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (result) => {
          if (result.requires_totp) {
            setServerError(t('login_totp_error'));
          }
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || err.message || t('login_failed_error');
          setServerError(msg);
        },
      }
    );
  };

  return (
    <AuthTemplate title={t('login_title')}>
      <View className="flex-1 justify-center py-6">

        {/* Header MoH Branding */}
        <View className="items-center mb-8">
          <View className="mb-4">
            <SvgXml xml={LOGO_SVG} width={80} height={80} />
          </View>
          <Text className="text-2xl font-bold text-center" style={{ color: colors.text }}>{t('pms_ihris')}</Text>
          <Text className="text-sm font-medium text-gray-500 text-center mt-1">
            Ministry of Health Uganda
          </Text>
          <Text className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-2">
            Saving Lives Livelihoods
          </Text>
        </View>

        {/* Form Card */}
        <Card>
          <Text className="text-lg font-bold mb-6" style={{ color: colors.text }}>{t('login_title')}</Text>

          <FormStatusAlert message={serverError} type="error" className="mb-4" />

          <View className="space-y-4">
            <Input
              label={t('login_email_label')}
              placeholder={t('login_email_placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              className="mb-4"
            />

            <Input
              label={t('login_password_label')}
              placeholder={t('login_password_placeholder')}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
            />

            <Button
              title={t('login_button')}
              onPress={handleLogin}
              loading={loginMutation.isPending}
              className="mt-6"
            />
          </View>

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-gray-500">{t('login_need_activate')}</Text>
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.primary }}
              onPress={() => navigation.navigate('Activate')}
            >
              {t('login_activate_link')}
            </Text>
          </View>

          {/* Demo Accounts Section */}
          <View className="mt-6 pt-5 border-t" style={{ borderTopColor: colors.border }}>
            <TouchableOpacity 
              onPress={() => setShowDemoAccounts(prev => !prev)}
              className="items-center"
            >
              <Text className="text-sm font-medium" style={{ color: colors.muted }}>
                {showDemoAccounts ? 'Hide demo accounts' : 'Show demo accounts for testing'}
              </Text>
            </TouchableOpacity>

            {showDemoAccounts && (
              <View className="mt-4 flex-col">
                {demoAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.email}
                    onPress={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setShowDemoAccounts(false);
                    }}
                    className="rounded-md border p-3 mb-3"
                    style={{ 
                      backgroundColor: email === account.email ? `${colors.primary}10` : colors.surface,
                      borderColor: email === account.email ? colors.primary : colors.border 
                    }}
                  >
                    <Text className="text-sm font-bold" style={{ color: colors.text }}>{account.label}</Text>
                    <Text className="text-xs mt-1" style={{ color: colors.muted }}>{account.description}</Text>
                    <Text className="mt-2 font-mono text-[10px]" style={{ color: colors.muted }}>{account.email}</Text>
                  </TouchableOpacity>
                ))}
                <Text className="text-center text-xs mt-1" style={{ color: colors.muted }}>
                  Demo password: <Text className="font-mono font-bold" style={{ color: colors.text }}>{DEMO_PASSWORD}</Text>
                </Text>
              </View>
            )}
          </View>
        </Card>

      </View>
    </AuthTemplate>
  );
}
