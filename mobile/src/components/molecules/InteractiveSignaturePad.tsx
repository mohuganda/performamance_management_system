import React, { useRef } from 'react';
import { Modal, View, TouchableOpacity, Text, useWindowDimensions, StyleSheet } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface InteractiveSignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onOK: (signature: string) => void;
}

export const InteractiveSignaturePad: React.FC<InteractiveSignaturePadProps> = ({ visible, onClose, onOK }) => {
  const ref = useRef<any>(null);
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  
  const handleSignature = (signature: string) => {
    onOK(signature);
    onClose();
  };

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  // Provide a clean white canvas style with a button area
  const webStyle = `
    .m-signature-pad {
      box-shadow: none; border: none;
      margin-left: 0px;
      margin-top: 0px;
    }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0px; }
  `;

  // We rotate the inner container 90 degrees so the user can draw in landscape mode.
  // The dimensions are swapped for the inner container.
  return (
    <Modal visible={visible} animationType="slide" transparent={false} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.container}>
        <View style={[styles.padContainer, { width: height, height: width }]}>
          <SignatureScreen
            ref={ref}
            onOK={handleSignature}
            webStyle={webStyle}
            autoClear={false}
            imageType="image/png"
          />
          
          <View style={styles.buttonContainer}>
             <TouchableOpacity style={styles.button} onPress={handleClear}>
               <Text style={styles.buttonText}>{t('profile_clear')}</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.buttonPrimary} onPress={handleConfirm}>
               <Text style={styles.buttonTextPrimary}>{t('profile_save_signature')}</Text>
             </TouchableOpacity>
          </View>
        </View>
        
        {/* Close Button positioned in the top right of the screen (portrait) */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={28} color="white" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padContainer: {
    backgroundColor: '#fff',
    // Rotate to fake landscape
    transform: [{ rotate: '90deg' }],
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  buttonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    backgroundColor: '#059669', // moh-green
  },
  buttonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    zIndex: 10,
  }
});
