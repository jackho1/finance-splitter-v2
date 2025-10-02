import React, { ReactNode, useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  ViewStyle,
  View,
  Dimensions,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface KeyboardAwareBottomSheetProps {
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
}

/**
 * A keyboard-aware wrapper for BottomSheetScrollView that automatically
 * adds padding and scrolls to keep content visible above the keyboard.
 * 
 * This component works with @gorhom/bottom-sheet in Expo by:
 * 1. Detecting keyboard appearance via useKeyboardHeight hook
 * 2. Adding dynamic bottom padding equal to keyboard height
 * 3. Auto-scrolling to the end to reveal focused inputs
 * 
 * IMPORTANT for Expo Projects:
 * - Add "softwareKeyboardLayoutMode": "pan" to android section in app.json
 * - The BottomSheetModal should have keyboardBehavior="interactive"
 * - The parent component should expand the modal when keyboard appears
 * 
 * @param children - Content to be rendered (typically input fields)
 * @param contentContainerStyle - Styles for the scroll content container
 * @param style - Styles for the scroll view itself
 * @param showsVerticalScrollIndicator - Whether to show scroll indicator (default: false)
 * 
 * @example
 * ```tsx
 * <BottomSheetModal 
 *   ref={bottomSheetRef}
 *   snapPoints={animatedSnapPoints}
 *   keyboardBehavior="interactive"
 * >
 *   <KeyboardAwareBottomSheet>
 *     <TextInput placeholder="Name" />
 *   </KeyboardAwareBottomSheet>
 * </BottomSheetModal>
 * ```
 */
export function KeyboardAwareBottomSheet({
  children,
  contentContainerStyle,
  style,
  showsVerticalScrollIndicator = false,
}: KeyboardAwareBottomSheetProps) {
  const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();
  const scrollViewRef = useRef<any>(null);

  // Auto-scroll when keyboard appears to reveal content
  useEffect(() => {
    if (isKeyboardVisible && scrollViewRef.current && keyboardHeight > 0) {
      // Delay to ensure keyboard animation is complete
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }, Platform.OS === 'ios' ? 150 : 100);

      return () => clearTimeout(timer);
    }
  }, [isKeyboardVisible, keyboardHeight]);

  return (
    <View style={styles.container}>
      <BottomSheetScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, style]}
        contentContainerStyle={[
          styles.contentContainer,
          contentContainerStyle,
          {
            // Dynamic padding based on keyboard height
            // This ensures content is pushed above the keyboard
            paddingBottom: isKeyboardVisible 
              ? keyboardHeight + 40  // Extra padding for visibility
              : 40, // Default padding when no keyboard
          },
        ]}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </BottomSheetScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
