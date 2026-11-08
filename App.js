import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MeetCompanionScreen from './src/screens/MeetCompanionScreen';
import MoodSelectionScreen from './src/screens/MoodSelectionScreen';
import PersonalizationScreen from './src/screens/PersonalizationScreen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { supabase } from './src/supabase';
/* ------------------------------- Themes ---------------------------------- */

const ACCENT = '#7C5CDB';

const LIGHT = { dark: false, text: '#2B2250', muted: '#6F6890', accent: ACCENT };

const THEMES = {
  morning: {
    ...LIGHT,
    greeting: 'Good morning',
    symbol: '☀️',
    title: 'A fresh day,\na fresh beginning.',
    description: 'Take a moment for yourself. Today is another opportunity to grow.',
    bg: '#FBF8FF',
    halo: '#F3ECFF',
    orbOuter: '#E8DEFA',
    orbInner: '#D9C8F5',
  },
  afternoon: {
    ...LIGHT,
    greeting: 'Hello there',
    symbol: '🌤️',
    title: 'Pause, breathe,\nand reconnect.',
    description: 'You deserve a little breathing space in the middle of your day.',
    bg: '#F6F2FF',
    halo: '#EEE6FE',
    orbOuter: '#E4D8FA',
    orbInner: '#D3BFF2',
  },
  evening: {
    ...LIGHT,
    greeting: 'Good evening',
    symbol: '🌅',
    title: 'Let the day\nslow down.',
    description: 'Whatever today brought, take a moment to reconnect with yourself.',
    bg: '#F1EBFE',
    halo: '#E9E0FB',
    orbOuter: '#DDD0F7',
    orbInner: '#CBB6EE',
  },
  night: {
    dark: true,
    text: '#F6F2FF',
    muted: '#BFB4E0',
    accent: '#9B82F0',
    greeting: 'Good night',
    symbol: '🌙',
    title: 'Rest your mind,\nfind your peace.',
    description: "Let go of today's worries. Tomorrow is another beginning.",
    bg: '#221D3B',
    halo: '#2A2446',
    orbOuter: '#3A3262',
    orbInner: '#53447F',
  },
};

function getPeriod() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// Alert.alert does nothing on web, so use window.alert there.
function notify(title, message) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

/* ----------------------------- Animation --------------------------------- */

// Value that eases 0 -> 1 -> 0 forever.
function useLoop(duration, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const step = (toValue) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });

    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.sequence([step(1), step(0)])),
    ]);
    anim.start();
    return () => anim.stop();
  }, [value, duration, delay]);

  return value;
}

const lerp = (value, from, to) =>
  value.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

// Fade and slide up on open.
function FadeIn({ delay = 0, style, children }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 800,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, delay]);

  return (
    <Animated.View
      style={[style, { opacity: value, transform: [{ translateY: lerp(value, 22, 0) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/* ------------------------------- Orb ------------------------------------- */

function Ripple({ color, size, delay }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: 6000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [value, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: lerp(value, 0.55, 0),
        transform: [{ scale: lerp(value, 1, 1.4) }],
      }}
    />
  );
}

function Sparkle({ color, x, y, size, duration, delay }) {
  const value = useLoop(duration, delay);

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: size,
        color,
        opacity: lerp(value, 0.2, 0.95),
        transform: [{ translateY: lerp(value, 0, -14) }, { scale: lerp(value, 0.75, 1.2) }],
      }}
    >
      ✦
    </Animated.Text>
  );
}

// Positions are fractions of the orb area so they scale with the screen.
const SPARKLES = [
  { x: 0.08, y: 0.12, size: 13, duration: 3200, delay: 0 },
  { x: 0.86, y: 0.22, size: 10, duration: 2800, delay: 600 },
  { x: 0.14, y: 0.82, size: 10, duration: 3600, delay: 1200 },
  { x: 0.8, y: 0.86, size: 14, duration: 3000, delay: 300 },
];

function BreathingOrb({ theme, size }) {
  const breath = useLoop(4000);
  const float = useLoop(2600);
  const area = size * 1.45;
  const inner = size * 0.69;

  return (
    <View style={{ width: area, height: area, alignItems: 'center', justifyContent: 'center' }}>
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} color={theme.accent} {...s} x={s.x * area} y={s.y * area} />
      ))}

      <Ripple color={theme.orbInner} size={size} delay={0} />
      <Ripple color={theme.orbInner} size={size} delay={3000} />

      <Animated.View
        style={{
          position: 'absolute',
          width: size * 1.2,
          height: size * 1.2,
          borderRadius: size * 0.6,
          backgroundColor: theme.halo,
          opacity: lerp(breath, 0.5, 0.95),
          transform: [{ scale: lerp(breath, 1, 1.14) }],
        }}
      />

      <Animated.View
        style={[
          styles.center,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.orbOuter,
            transform: [{ scale: lerp(breath, 1, 1.06) }],
          },
        ]}
      >
        <View
          style={[
            styles.center,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: theme.orbInner,
            },
          ]}
        >
          <Animated.Text
            style={{
              fontSize: inner * 0.5,
              transform: [
                { translateY: lerp(float, 5, -7) },
                { rotate: lerp(float, '-5deg', '5deg') },
              ],
            }}
          >
            {theme.symbol}
          </Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ------------------------------ Screens ---------------------------------- */

export default function App() {
  const { width, height } = useWindowDimensions();
  const [period, setPeriod] = useState(getPeriod);
  const [screen, setScreen] = useState('welcome'); // welcome -> meet -> mood -> personalization -> auth
  const [user, setUser] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null); // ready to use on later screens
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setPeriod(getPeriod()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setScreen('home');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        setScreen('home');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setScreen('welcome');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setScreen('welcome');
    } catch (error) {
      notify('Sign Out Failed', error?.message || 'Unable to sign out. Please try again.');
    }
  };

  // All hooks are above this line, so these early returns are safe.

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <HomeScreen
        user={user}
        onOpenCompanion={() => setScreen('chat')}
        onOpenProgress={() =>
          notify('Coming soon', 'Your progress screen is being prepared.')
        }
        onOpenProfile={() => setScreen('profile')}
      />
    );
  }

  // AI CHAT SCREEN
  if (screen === 'chat') {
    return (
      <ChatScreen
        user={user}
        onBack={() => setScreen('home')}
      />
    );
  }

  // PROFILE SCREEN
  if (screen === 'profile') {
    return (
      <ProfileScreen
        user={user}
        onBack={() => setScreen('home')}
        onUserUpdated={(updatedUser) => setUser(updatedUser)}
        onSignOut={handleSignOut}
      />
    );
  }

  // MEET SOLACE SCREEN
  if (screen === 'meet') {
    return (
      <MeetCompanionScreen
        onBack={() => setScreen('welcome')}
        onContinue={() => setScreen('mood')}
        onSkip={() => setScreen('mood')}
      />
    );
  }

  // MOOD SELECTION SCREEN
  if (screen === 'mood') {
    return (
      <MoodSelectionScreen
        onBack={() => setScreen('meet')}
        onContinue={(mood) => {
          setSelectedMood(mood);
          setScreen('personalization');
        }}
        onSkip={() => setScreen('personalization')}
      />
    );
  }

  // PERSONALIZATION SCREEN
  if (screen === 'personalization') {
    return (
      <PersonalizationScreen
        onBack={() => setScreen('mood')}
        onContinue={(goals) => {
          console.log('Continue clicked. Selected goals:', goals);
          setScreen('auth');
        }}
        onSkip={() => {
          notify('Skipped', 'You can choose your goals later.');
          setScreen('auth');
        }}
      />
    );
  }

  // AUTH SCREEN
  if (screen === 'auth') {
    return (
      <AuthScreen
        onBack={() => setScreen('personalization')}
        onSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          setScreen('home');
        }}
      />
    );
  }

  // WELCOME SCREEN
  const theme = THEMES[period];
  const orbSize = Math.min(width * 0.55, height * 0.26);

  const squish = (toValue) =>
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Brand */}
          <FadeIn style={styles.header}>
            <View style={[styles.logo, { backgroundColor: theme.accent }]}>
              <Text style={styles.logoSymbol}>✦</Text>
            </View>
            <Text style={[styles.brand, { color: theme.text }]}>
              solace<Text style={{ color: theme.accent }}>.</Text>
            </Text>
          </FadeIn>

          {/* Welcome */}
          <FadeIn delay={150} style={styles.welcome}>
            <Text style={[styles.greeting, { color: theme.muted }]}>
              {theme.greeting} {theme.symbol}
            </Text>
            <Text style={[styles.heading, { color: theme.text }]}>
              {theme.title}
            </Text>
            <Text style={[styles.description, { color: theme.muted }]}>
              {theme.description}
            </Text>
          </FadeIn>

          {/* Orb */}
          <FadeIn delay={350} style={styles.visual}>
            <BreathingOrb theme={theme} size={orbSize} />
          </FadeIn>

          {/* Button */}
          <FadeIn delay={550}>
            <Pressable
              onPress={() => setScreen('meet')}
              onPressIn={() => squish(0.96)}
              onPressOut={() => squish(1)}
            >
              <Animated.View
                style={[
                  styles.button,
                  {
                    backgroundColor: theme.accent,
                    transform: [{ scale: press }],
                  },
                ]}
              >
                <Text style={styles.buttonText}>Get started</Text>
                <Text style={styles.arrow}>→</Text>
              </Animated.View>
            </Pressable>
          </FadeIn>
        </View>
      </SafeAreaView>
    </View>
  );
}


/* ------------------------------ Styles ----------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSymbol: { color: '#FFFFFF', fontSize: 22 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },

  welcome: { marginTop: 24 },
  greeting: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  heading: { fontSize: 34, fontWeight: '800', lineHeight: 42, letterSpacing: -1.1 },
  description: { fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 320 },

  visual: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  button: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  arrow: { color: '#FFFFFF', fontSize: 20, position: 'absolute', right: 22 },
});