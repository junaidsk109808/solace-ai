
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
  StatusBar as RNStatusBar,
  Dimensions,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { supabase } from '../supabase';

import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const COLORS = {
  background: '#F9F6FF',
  surface: '#FFFFFF',
  primary: '#8665BD',
  soft: '#E8DEFA',
  heading: '#33264D',
  text: '#716982',
  muted: '#958AA8',
  border: '#E9E1F3',
  error: '#D9566B',
};

// Alert messages
function showAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Friendly error messages
function friendlyError(message = '') {
  const text = message.toLowerCase();

  if (text.includes('invalid login')) {
    return 'Incorrect login details.';
  }

  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts. Please wait and try again.';
  }

  if (text.includes('network') || text.includes('fetch')) {
    return 'Network problem. Check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}

/* ----------------------------- Animation --------------------------------- */

const lerp = (value, from, to) =>
  value.interpolate({
    inputRange: [0, 1],
    outputRange: [from, to],
  });

function FadeIn({ delay = 0, from = 20, style, children }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 600,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [{ translateY: lerp(value, from, 0) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ----------------------------- Back button ------------------------------- */

function BackButton({ onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const squish = (toValue) =>
    Animated.spring(scale, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => squish(0.94)}
      onPressOut={() => squish(1)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Animated.View
        style={[styles.backButton, { transform: [{ scale }] }]}
      >
        <View style={styles.backIcon}>
          <Text style={styles.backChevron}>‹</Text>
        </View>

        <Text style={styles.backText}>Back</Text>
      </Animated.View>
    </Pressable>
  );
}

/* ----------------------------- OAuth setup ------------------------------- */

const redirectTo = makeRedirectUri({
  scheme: 'solaceai',
  path: 'auth/callback',
});

console.log('GOOGLE REDIRECT URL:', redirectTo);

/* ----------------------------- OAuth callback ---------------------------- */

async function createSessionFromUrl(url) {
  const parsed = new URL(url);

  const params = new URLSearchParams(parsed.search);

  const hashParams = new URLSearchParams(
    parsed.hash.startsWith('#')
      ? parsed.hash.substring(1)
      : parsed.hash
  );

  const error =
    params.get('error_description') ||
    params.get('error') ||
    hashParams.get('error_description') ||
    hashParams.get('error');

  if (error) {
    throw new Error(error);
  }

  // PKCE authorization code
  const code = params.get('code') || hashParams.get('code');

  if (code) {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;

    return data.session;
  }

  // Implicit flow tokens
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;

    return data.session;
  }

  console.log('OAuth callback parameter names:', [
    ...new Set([...params.keys(), ...hashParams.keys()]),
  ]);

  throw new Error(
    'No authorization code or session tokens were returned.'
  );
}

/* ------------------------------ Screen ----------------------------------- */

export default function AuthScreen({ onSuccess, onBack }) {
  const [loading, setLoading] = useState(false);
  const [compact] = useState(
    () => Dimensions.get('window').height < 740
  );

  const press = useRef(new Animated.Value(1)).current;

  const squish = (toValue) =>
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  // Listen for successful authentication
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        onSuccess?.(session.user);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [onSuccess]);

  // Google sign-in
  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);

    try {
      if (Platform.OS === 'web') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo:
              typeof window !== 'undefined'
                ? window.location.origin
                : undefined,
          },
        });

        if (error) throw error;

        if (data?.url && typeof window !== 'undefined') {
          window.location.href = data.url;
        }

        return;
      }

      // Android / iOS Google authentication
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;

      if (!data?.url) {
        throw new Error('Unable to open Google sign-in.');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
      } else if (result.type === 'error') {
        throw new Error('Google sign-in could not be completed.');
      } else if (
        result.type === 'cancel' ||
        result.type === 'dismiss'
      ) {
        return;
      }
    } catch (error) {
      console.error('GOOGLE AUTH ERROR:', error);
      console.error('GOOGLE AUTH MESSAGE:', error?.message);

      showAlert(
        'Google sign-in',
        friendlyError(error?.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {onBack && (
          <FadeIn from={-10} style={styles.backRow}>
            <BackButton onPress={onBack} />
          </FadeIn>
        )}

        <View style={styles.centerSection}>
          <FadeIn delay={100} style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>✦</Text>
            </View>

            <Text style={styles.brand}>
              solace<Text style={{ color: COLORS.primary }}>.</Text>
            </Text>

            <Text style={styles.title}>Welcome to Solace</Text>

            <Text style={styles.subtitle}>
              Your space for a calmer mind.
            </Text>
          </FadeIn>

          <FadeIn delay={250} style={styles.actionSection}>
            <Pressable
              onPress={handleGoogleLogin}
              onPressIn={() => squish(0.97)}
              onPressOut={() => squish(1)}
              disabled={loading}
            >
              <Animated.View
                style={[
                  styles.googleButton,
                  loading && styles.googleLoading,
                  { transform: [{ scale: press }] },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Animated.View>
            </Pressable>
          </FadeIn>
        </View>

        <FadeIn delay={400} style={styles.bottom}>
          <Text style={styles.footer}>
            Your journey to wellbeing starts here. 💜
          </Text>
        </FadeIn>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------ Styles ----------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop:
      Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },

  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },

  backRow: {
    alignItems: 'flex-start',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 22,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  backIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  backChevron: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: -2,
  },

  backText: {
    color: COLORS.heading,
    fontSize: 14,
    fontWeight: '700',
  },

  centerSection: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
  },

  logo: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 32,
  },

  brand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    color: COLORS.heading,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: COLORS.heading,
    marginTop: 18,
  },

  subtitle: {
    color: COLORS.text,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  actionSection: {
    paddingHorizontal: 8,
  },

  googleButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  googleLoading: {
    opacity: 0.8,
  },

  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },

  googleText: {
    color: COLORS.heading,
    fontSize: 15,
    fontWeight: '700',
  },

  bottom: {
    alignItems: 'center',
    paddingBottom: 6,
  },

  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
  },
});
