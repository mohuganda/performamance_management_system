import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Easing, TouchableWithoutFeedback } from 'react-native';
import { useAlertStore } from '../../../stores/alertStore';
import { Button } from '../../atoms/Button';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useTranslation } from 'react-i18next';

export const GlobalAlertModal = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const storeState = useAlertStore();
  const [visible, setVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (storeState.isOpen) {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      if (storeState.autoDismiss) {
        const timer = setTimeout(() => {
          storeState.hideAlert();
        }, storeState.autoDismiss);
        return () => clearTimeout(timer);
      }
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }).start(() => {
        setVisible(false);
      });
    }
  }, [storeState.isOpen, storeState.autoDismiss, opacity, storeState.hideAlert]);

  const handleClose = () => {
    storeState.hideAlert();
  };

  const handleConfirm = async () => {
    if (storeState.onConfirm) {
      await storeState.onConfirm();
    }
    handleClose();
  };

  const handleCancel = async () => {
    if (storeState.onCancel) {
      await storeState.onCancel();
    }
    handleClose();
  };

  const handleBackdropPress = () => {
    if (storeState.dismissable) {
      handleCancel();
    }
  };

  if (!visible && !storeState.isOpen) return null;

  const getIcon = () => {
    const size = 32;
    switch (storeState.type) {
      case 'success':
        return <CheckCircle size={size} color="#22C55E" />;
      case 'error':
        return <XCircle size={size} color="#D90000" />;
      case 'warning':
        return <Info size={size} color="#F97316" />;
      case 'info':
      default:
        return <Info size={size} color="#3B82F6" />;
    }
  };

  const confirmVariant = storeState.type === 'error' ? 'danger' : 'primary';

  const confirmTextValue = storeState.confirmText || t('common_okay', 'Okay');
  const showCancel = storeState.cancelText !== undefined || storeState.onCancel !== undefined;
  const cancelTextValue = storeState.cancelText || t('common_cancel', 'Cancel');

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleBackdropPress}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View className="flex-1 bg-black/70 justify-center items-center p-6">
          <TouchableWithoutFeedback>
            <Animated.View
              className="w-full max-w-[400px] rounded-none px-6 pb-16 pt-10 items-center shadow-lg bg-white dark:bg-zinc-900"
              style={{ opacity }}
            >
              <View className="mb-4">{getIcon()}</View>
              <Text className="text-lg font-semibold text-center mb-2 text-zinc-900 dark:text-zinc-50">
                {storeState.title}
              </Text>
              {!!storeState.message && (
                <Text className="text-sm text-center leading-5 mb-6 text-zinc-600 dark:text-zinc-400">
                  {storeState.message}
                </Text>
              )}

              <View className="flex-row w-full justify-center mt-6">
                {showCancel && (
                  <View className="flex-1">
                    <Button variant="secondary" title={cancelTextValue} onPress={handleCancel} />
                  </View>
                )}
                {/* Space between if two buttons */}
                {showCancel && <View className="w-3" />}
                <View className="flex-1">
                  <Button variant={confirmVariant} title={confirmTextValue} onPress={handleConfirm} />
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
