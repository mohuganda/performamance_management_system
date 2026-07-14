import React from 'react';

import { Edge } from 'react-native-safe-area-context';

import { Screen } from './Screen';

interface LayoutTemplateProps {
  children: React.ReactNode;
  edges?: Edge[];
}

export const LayoutTemplate = ({ children, edges }: LayoutTemplateProps) => {
  return (
    <Screen className="bg-background" edges={edges}>
      {children}
    </Screen>
  );
};
