import React from 'react';

import { Screen } from './Screen';
import { AppBar } from '../organisms/AppBar';

interface MainTemplateProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export const MainTemplate = ({
  title,
  children,
  showBack = false,
  rightElement,
}: MainTemplateProps) => {
  return (
    <Screen className="bg-background">
      <AppBar title={title} showBack={showBack} rightElement={rightElement} />
      {children}
    </Screen>
  );
};
