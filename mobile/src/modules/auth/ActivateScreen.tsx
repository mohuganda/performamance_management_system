import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/types';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Card } from '../../components/atoms/Card';
import { FormStatusAlert } from '../../components/molecules/FormStatusAlert';
import { AuthTemplate } from '../../components/templates';
import apiClient from '../../api/client';
import { z } from 'zod';

const activationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  token: z.string().min(1, 'Activation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ActivateScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Activate'>;

export function ActivateScreen() {
  const navigation = useNavigation<ActivateScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'request' | 'complete'>('request');

  const handleRequestToken = async () => {
    setStatusMessage(null);
    setErrors({});

    if (!email || !email.includes('@')) {
      setErrors({ email: 'Please enter a valid work email' });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/request-activation', { email: email.trim() });
      setStatusMessage({
        text: 'An activation token has been sent to your email address.',
        type: 'success',
      });
      setStep('complete');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Request failed. Please check your email.';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteActivation = async () => {
    setStatusMessage(null);
    setErrors({});

    const validation = activationSchema.safeParse({ email, token, password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/activation/complete', {
        email: email.trim(),
        token: token.trim(),
        password,
      });
      setStatusMessage({
        text: 'Activation completed successfully! Redirecting to login...',
        type: 'success',
      });
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Activation failed.';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthTemplate title="Activate Profile">
      <View className="flex-1 justify-center py-6">
        
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
            <Text className="text-2xl font-bold text-primary">PMS</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center">Activate Profile</Text>
        </View>

        <Card>
          <FormStatusAlert
            message={statusMessage ? statusMessage.text : null}
            type={statusMessage ? statusMessage.type : 'error'}
            className="mb-6"
          />

          {step === 'request' ? (
            <View className="space-y-4">
              <Text className="text-base text-gray-600 mb-2">
                Enter your registered work email to request your secure activation code.
              </Text>
              
              <Input
                label="Work Email Address"
                placeholder="worker@moh.go.ug"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
              />

              <Button
                title="Request Code"
                onPress={handleRequestToken}
                loading={loading}
                className="mt-4"
              />
            </View>
          ) : (
            <View className="space-y-4">
              <Input
                label="Activation Token"
                placeholder="Enter code received"
                autoCapitalize="none"
                value={token}
                onChangeText={setToken}
                error={errors.token}
              />

              <Input
                label="Set Password"
                placeholder="Min 8 characters"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                placeholder="Re-enter password"
                secureTextEntry
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
              />

              <Button
                title="Complete Profile Setup"
                onPress={handleCompleteActivation}
                loading={loading}
                className="mt-4"
              />

              <Button
                title="Back to Email Request"
                variant="secondary"
                onPress={() => setStep('request')}
                className="mt-2"
              />
            </View>
          )}

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-gray-500">Back to </Text>
            <Text
              className="text-sm font-semibold text-primary"
              onPress={() => navigation.navigate('Login')}
            >
              Sign In
            </Text>
          </View>
        </Card>

      </View>
    </AuthTemplate>
  );
}
