import React from 'react';

import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import { Screen } from './Screen';

interface AuthTemplateProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
}

export const AuthTemplate = ({ title, children, showBack = false }: AuthTemplateProps) => {
  return (
    <Screen className="bg-gray-50">
      {/* <Header title={title} showBack={showBack} /> */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
