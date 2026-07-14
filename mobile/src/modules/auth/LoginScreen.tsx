import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { AuthStackParamList } from '../../app/navigation/types';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Card } from '../../components/atoms/Card';
import { FormStatusAlert } from '../../components/molecules/FormStatusAlert';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setServerError(null);
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.requires_totp) {
        // Redirect to TOTP/OTP confirmation screen or prompt
        setServerError('TOTP multi-factor verification required. Please complete account activation first.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please verify credentials.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F4F4F5]"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          
          {/* Header MoH Branding */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl font-extrabold text-primary">MoH</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 text-center">PMS - iHRIS Mobile</Text>
            <Text className="text-sm font-medium text-gray-500 text-center mt-1">
              Ministry of Health Uganda
            </Text>
            <Text className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-2">
              Saving Lives Livelihoods
            </Text>
          </View>

          {/* Form Card */}
          <Card>
            <Text className="text-lg font-bold text-gray-800 mb-6">Account Sign In</Text>

            <FormStatusAlert message={serverError} type="error" className="mb-4" />

            <View className="space-y-4">
              <Input
                label="Work Email Address"
                placeholder="worker@moh.go.ug"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
              />

              <Input
                label="Security Password"
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                className="mt-6"
              />
            </View>

            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-sm text-gray-500">Need to activate account? </Text>
              <Text
                className="text-sm font-semibold text-primary"
                onPress={() => navigation.navigate('Activate')}
              >
                Activate Profile
              </Text>
            </View>
          </Card>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
