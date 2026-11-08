import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const COLORS = {
  background: '#F9F6FF',
  primary: '#8665BD',
  secondary: '#B69ADD',
  soft: '#E8DEFA',
  heading: '#33264D',
  text: '#716982',
  white: '#FFFFFF',
};

/* ----------------------------- Animation --------------------------------- */

// Gentle 0 -> 1 -> 0 loop used for breathing, floating and twinkling.
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

// Fades in and slides up when the page opens. `delay` staggers the pieces.
function FadeIn({ delay = 0, from = 24, style, children }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 700,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, delay]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: value, transform: [{ translateY: lerp(value, from, 0) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// A ring that spreads out from the orb and fades away.
function Ripple({ delay }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: 5000,
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
      style={[
        styles.ripple,
        {
          opacity: lerp(value, 0.6, 0),
          transform: [{ scale: lerp(value, 1, 1.55) }],
        },
      ]}
    />
  );
}

/* ----------------------------- Back button -------------------------------- */

function BackButton({ onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const nudge = useLoop(1400);

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
      <Animated.View style={[styles.backButton, { transform: [{ scale }] }]}>
        <View style={styles.backIcon}>
          <Animated.Text
            style={[
              styles.backChevron,
              { transform: [{ translateX: lerp(nudge, 0, -2) }] },
            ]}
          >
            ‹
          </Animated.Text>
        </View>
        <Text style={styles.backText}>Back</Text>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------ Screen ----------------------------------- */

export default function MeetCompanionScreen({ onBack, onContinue, onSkip }) {
  const breath = useLoop(4000);
  const float = useLoop(2800);
  const floatTwo = useLoop(3400, 600);
  const spin = useLoop(3000);
  const arrow = useLoop(900);
  const press = useRef(new Animated.Value(1)).current;

  const squish = (toValue) =>
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {/* Back button, top left */}
        {onBack && (
          <FadeIn from={-10} style={styles.header}>
            <BackButton onPress={onBack} />
          </FadeIn>
        )}

        <FadeIn from={-12} style={styles.stepWrap}>
          <Text style={styles.step}>
            YOUR PERSONAL WELLNESS COMPANION
          </Text>
        </FadeIn>

        <FadeIn delay={150} from={0} style={styles.illustration}>
          <Ripple delay={0} />
          <Ripple delay={2500} />

          <Animated.View
            style={[
              styles.outerCircle,
              { transform: [{ scale: lerp(breath, 1, 1.07) }] },
            ]}
          >
            <View style={styles.innerCircle}>
              <Animated.Text
                style={[
                  styles.orb,
                  {
                    transform: [
                      { rotate: lerp(spin, '-12deg', '12deg') },
                      { scale: lerp(spin, 0.95, 1.1) },
                    ],
                  },
                ]}
              >
                ✦
              </Animated.Text>
            </View>
          </Animated.View>

          <Animated.Text
            style={[
              styles.sparkle,
              {
                opacity: lerp(float, 0.4, 1),
                transform: [
                  { translateY: lerp(float, 4, -12) },
                  { scale: lerp(float, 0.85, 1.15) },
                ],
              },
            ]}
          >
            ✧
          </Animated.Text>
          <Animated.Text
            style={[
              styles.sparkleTwo,
              {
                opacity: lerp(floatTwo, 1, 0.4),
                transform: [
                  { translateY: lerp(floatTwo, 0, -14) },
                  { scale: lerp(floatTwo, 1.1, 0.8) },
                ],
              },
            ]}
          >
            ✦
          </Animated.Text>
        </FadeIn>

        <FadeIn delay={300}>
          <Text style={styles.title}>
            Meet your new{'\n'}AI companion
          </Text>

          <Text style={styles.description}>
            A safe space to share your thoughts, understand your emotions,
            and find little moments of calm.
          </Text>
        </FadeIn>

        <FadeIn delay={450} style={styles.benefits}>
          <FadeIn delay={550} from={14}>
            <Text style={styles.benefit}>♡  Understand your emotions</Text>
          </FadeIn>
          <FadeIn delay={700} from={14}>
            <Text style={styles.benefit}>☁  Find moments of calm</Text>
          </FadeIn>
          <FadeIn delay={850} from={14}>
            <Text style={styles.benefit}>✧  Build healthier habits</Text>
          </FadeIn>
        </FadeIn>

        <FadeIn delay={950} style={styles.bottom}>
          <Pressable
            style={styles.buttonWrap}
            onPress={onContinue}
            onPressIn={() => squish(0.96)}
            onPressOut={() => squish(1)}
          >
            <Animated.View
              style={[styles.button, { transform: [{ scale: press }] }]}
            >
              <Text style={styles.buttonText}>Continue</Text>
              <Animated.Text
                style={[
                  styles.arrow,
                  { transform: [{ translateX: lerp(arrow, 0, 6) }] },
                ]}
              >
                →
              </Animated.Text>
            </Animated.View>
          </Pressable>

          <Pressable onPress={onSkip} hitSlop={12}>
            <Text style={styles.skip}>Skip for now</Text>
          </Pressable>
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
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 24,
    alignItems: 'center',
  },

  /* Back button */
  header: {
    width: '100%',
    alignItems: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
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

  stepWrap: {
    marginTop: 18,
  },
  step: {
    fontSize: 11,
    letterSpacing: 2.4,
    color: COLORS.primary,
    fontWeight: '700',
  },
  illustration: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  ripple: {
    position: 'absolute',
    height: 190,
    width: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  outerCircle: {
    height: 190,
    width: 190,
    borderRadius: 95,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(182, 154, 221, 0.18)',
  },
  innerCircle: {
    height: 125,
    width: 125,
    borderRadius: 63,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  orb: {
    fontSize: 65,
    color: COLORS.white,
  },
  sparkle: {
    position: 'absolute',
    top: 10,
    right: 45,
    fontSize: 35,
    color: COLORS.primary,
  },
  sparkleTwo: {
    position: 'absolute',
    bottom: 10,
    left: 45,
    fontSize: 25,
    color: COLORS.secondary,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: COLORS.heading,
    textAlign: 'center',
    marginTop: 5,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 5,
  },
  benefits: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginTop: 24,
    gap: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  benefit: {
    fontSize: 15,
    color: COLORS.heading,
    fontWeight: '600',
  },
  bottom: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
    gap: 14,
  },
  buttonWrap: {
    width: '100%',
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  arrow: {
    position: 'absolute',
    right: 24,
    color: COLORS.white,
    fontSize: 20,
  },
  skip: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 5,
  },
});