import React, { useState } from 'react';
import { View, Text } from 'react-native';
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
import { activationSchema } from '../../app/schemas/auth';
import {
  useRequestActivationMutation,
  useCompleteActivationMutation,
} from '../../app/hooks/useAuthMutations';
import { useTheme } from '../../app/hooks/useTheme';
import { LOGO_SVG } from '../../assets/logoSvg';

type ActivateScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Activate'>;

export function ActivateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ActivateScreenNavigationProp>();

  const requestMutation = useRequestActivationMutation();
  const completeMutation = useCompleteActivationMutation();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [step, setStep] = useState<'request' | 'complete'>('request');

  const handleRequestToken = async () => {
    setStatusMessage(null);
    setErrors({});

    if (!email || !email.includes('@')) {
      setErrors({ email: t('login_email_error') });
      return;
    }

    requestMutation.mutate(email.trim(), {
      onSuccess: () => {
        setStatusMessage({
          text: t('activate_token_sent_success'),
          type: 'success',
        });
        setStep('complete');
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || err.message || t('activate_request_failed_error');
        setStatusMessage({ text: msg, type: 'error' });
      },
    });
  };

  const handleCompleteActivation = async () => {
    setStatusMessage(null);
    setErrors({});

    const validation = activationSchema.safeParse({ email, token, password, confirmPassword });
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

    completeMutation.mutate(
      { email: email.trim(), token: token.trim(), password },
      {
        onSuccess: () => {
          setStatusMessage({
            text: t('activate_complete_success'),
            type: 'success',
          });
          setTimeout(() => {
            navigation.navigate('Login');
          }, 2000);
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || err.message || t('activate_failed_error');
          setStatusMessage({ text: msg, type: 'error' });
        },
      }
    );
  };

  return (
    <AuthTemplate title={t('activate_title')}>
      <View className="flex-1 justify-center py-6">

        <View className="items-center mb-8">
          <View className="mb-4">
            <SvgXml xml={LOGO_SVG} width={80} height={80} />
          </View>
          <Text className="text-2xl font-bold text-center" style={{ color: colors.text }}>{t('activate_title')}</Text>
        </View>

        <Card>
          <FormStatusAlert
            message={statusMessage ? statusMessage.text : null}
            type={statusMessage ? statusMessage.type : 'error'}
            className="mb-6"
          />

          {step === 'request' ? (
            <View className="space-y-4">
              <Text className="text-base text-gray-600 mb-5">
                {t('activate_instruction')}
              </Text>

              <Input
                label={t('activate_email_label')}
                placeholder={t('activate_email_placeholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                className="mb-5"
              />

              <Button
                title={t('activate_request_code_button')}
                onPress={handleRequestToken}
                loading={requestMutation.isPending}
                className="mt-4"
              />
            </View>
          ) : (
            <View className="space-y-4">
              <Input
                label={t('activate_token_label')}
                placeholder={t('activate_token_placeholder')}
                autoCapitalize="none"
                value={token}
                onChangeText={setToken}
                error={errors.token}
                className="mb-5"
              />

              <Input
                label={t('activate_new_password_label')}
                placeholder={t('activate_new_password_placeholder')}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                className="mb-5"
              />

              <Input
                label={t('activate_confirm_password_label')}
                placeholder={t('activate_confirm_password_placeholder')}
                secureTextEntry
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                className="mb-5"
              />

              <Button
                title={t('activate_submit_button')}
                onPress={handleCompleteActivation}
                loading={completeMutation.isPending}
                className="mt-4"
              />

              <Button
                title={t('activate_back_email_button')}
                variant="secondary"
                onPress={() => setStep('request')}
                className="mt-2"
              />
            </View>
          )}

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-gray-500">{t('activate_back_to')}</Text>
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.primary }}
              onPress={() => navigation.navigate('Login')}
            >
              {t('activate_sign_in_link')}
            </Text>
          </View>
        </Card>

      </View>
    </AuthTemplate>
  );
}
