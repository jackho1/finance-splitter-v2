import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface KeyboardAvoidingContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  keyboardVerticalOffset?: number;
  behavior?: 'height' | 'position' | 'padding';
  enabled?: boolean;
}

/**
 * A reusable container component that automatically adjusts its position
 * when the keyboard appears, ensuring input fields remain visible.
 * 
 * This component wraps React Native's KeyboardAvoidingView with sensible
 * defaults for both iOS and Android platforms.
 * 
 * @param children - Content to be rendered inside the container
 * @param style - Optional custom styles
 * @param keyboardVerticalOffset - Additional offset from the keyboard (default: 0)
 * @param behavior - Keyboard avoiding behavior (default: 'padding' on iOS, 'height' on Android)
 * @param enabled - Whether keyboard avoidance is enabled (default: true)
 * 
 * @example
 * ```tsx
 * <KeyboardAvoidingContainer>
 *   <TextInput placeholder="Enter text" />
 * </KeyboardAvoidingContainer>
 * ```
 */
export function KeyboardAvoidingContainer({
  children,
  style,
  keyboardVerticalOffset = 0,
  behavior = Platform.OS === 'ios' ? 'padding' : 'height',
  enabled = true,
}: KeyboardAvoidingContainerProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
      enabled={enabled}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
