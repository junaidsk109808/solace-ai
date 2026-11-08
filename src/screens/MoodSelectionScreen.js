import React, { useEffect, useRef, useState } from 'react';
import {
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

const COLORS = {
  background: '#F9F6FF',
  surface: '#FFFFFF',
  primary: '#8665BD',
  secondary: '#B69ADD',
  soft: '#E8DEFA',
  heading: '#33264D',
  text: '#716982',
  border: '#E9E1F3',
  white: '#FFFFFF',
};

const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'sad', emoji: '😔', label: 'Sad' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'stressed', emoji: '😣', label: 'Stressed' },
];

// Two moods per row, so the grid can stretch to fill the screen.
const ROWS = [MOODS.slice(0, 2), MOODS.slice(2, 4), MOODS.slice(4, 6)];

/* ----------------------------- Animation --------------------------------- */

// Gentle 0 -> 1 -> 0 loop.
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
function FadeIn({ delay = 0, from = 22, style, children }) {
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
        { opacity: value, transform: [{ translateY: lerp(value, from, 0) }] },
      ]}
    >
      {children}
    </Animated.View>
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

/* ----------------------------- Mood card ---------------------------------- */

function MoodCard({ mood, isSelected, onPress }) {
  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // Pops the emoji and the tick when the card becomes selected.
  useEffect(() => {
    Animated.spring(pop, {
      toValue: isSelected ? 1 : 0,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [isSelected, pop]);

  const squish = (toValue) =>
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      style={styles.cardPressable}
      onPress={onPress}
      onPressIn={() => squish(0.95)}
      onPressOut={() => squish(1)}
    >
      <Animated.View
        style={[
          styles.moodCard,
          isSelected && styles.selectedCard,
          { transform: [{ scale: press }] },
        ]}
      >
        <Animated.Text
          style={[
            styles.moodEmoji,
            {
              transform: [
                { scale: lerp(pop, 1, 1.2) },
                { translateY: lerp(pop, 0, -3) },
              ],
            },
          ]}
        >
          {mood.emoji}
        </Animated.Text>

        <Text style={[styles.moodLabel, isSelected && styles.selectedLabel]}>
          {mood.label}
        </Text>

        <Animated.View
          style={[styles.check, { opacity: pop, transform: [{ scale: pop }] }]}
        >
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------ Screen ----------------------------------- */

export default function MoodSelectionScreen({ onContinue, onSkip, onBack }) {
  const { height } = useWindowDimensions();
  const [selectedMood, setSelectedMood] = useState(null);

  // Short phones hide the big emoji and the description so nothing needs scrolling.
  const compact = height < 720;

  const float = useLoop(2600);
  const arrow = useLoop(900);
  const progress = useRef(new Animated.Value(0)).current;
  const ready = useRef(new Animated.Value(0.45)).current;
  const press = useRef(new Animated.Value(1)).current;

  // Progress bar fills up to 25% when the page opens.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Continue button lights up once a mood is picked.
  useEffect(() => {
    Animated.timing(ready, {
      toValue: selectedMood ? 1 : 0.45,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectedMood, ready]);

  const squish = (toValue) =>
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  const handleContinue = () => {
    if (!selectedMood) return;
    onContinue?.(selectedMood);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {/* Back button, top left */}
        {onBack && (
          <FadeIn from={-10} style={styles.backRow}>
            <BackButton onPress={onBack} />
          </FadeIn>
        )}

        <FadeIn from={-10} style={styles.header}>
          <Text style={styles.step}>YOUR DAILY CHECK-IN</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: lerp(progress, '0%', '25%') },
              ]}
            />
          </View>

          <Text style={styles.stepCount}>STEP 1 OF 4</Text>
        </FadeIn>

        <FadeIn delay={150} style={styles.intro}>
          {!compact && (
            <Animated.Text
              style={[
                styles.emoji,
                { transform: [{ translateY: lerp(float, 3, -6) }] },
              ]}
            >
              🌷
            </Animated.Text>
          )}

          <Text style={[styles.title, compact && styles.titleCompact]}>
            How are you feeling{'\n'}today?
          </Text>

          {!compact && (
            <Text style={styles.description}>
              Take a moment for yourself. There are no right or wrong
              answers. Just choose what feels closest to you.
            </Text>
          )}
        </FadeIn>

        {/* Grid stretches to fill the leftover space */}
        <View style={styles.moodGrid}>
          {ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.moodRow}>
              {row.map((mood, colIndex) => (
                <FadeIn
                  key={mood.id}
                  delay={300 + (rowIndex * 2 + colIndex) * 90}
                  from={18}
                  style={styles.cardWrap}
                >
                  <MoodCard
                    mood={mood}
                    isSelected={selectedMood === mood.id}
                    onPress={() => setSelectedMood(mood.id)}
                  />
                </FadeIn>
              ))}
            </View>
          ))}
        </View>

        <FadeIn delay={900} style={styles.bottom}>
          <Text style={styles.footerMessage}>
            Every feeling deserves to be heard. 💜
          </Text>

          <Pressable
            style={styles.buttonWrap}
            onPress={handleContinue}
            onPressIn={() => selectedMood && squish(0.96)}
            onPressOut={() => squish(1)}
            disabled={!selectedMood}
          >
            <Animated.View
              style={[
                styles.button,
                { opacity: ready, transform: [{ scale: press }] },
              ]}
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
    paddingHorizontal: 25,
    paddingTop: 14,
    paddingBottom: 22,
  },

  /* Back button */
  backRow: {
    alignItems: 'flex-start',
    marginBottom: 16,
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

  /* Header */
  header: {
    gap: 10,
  },
  step: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: COLORS.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.soft,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  stepCount: {
    fontSize: 10,
    color: COLORS.text,
    letterSpacing: 1.5,
    fontWeight: '600',
  },

  /* Intro */
  intro: {
    alignItems: 'center',
    marginTop: 22,
  },
  emoji: {
    fontSize: 42,
    marginBottom: 12,
  },
  title: {
    fontSize: 31,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: COLORS.heading,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 33,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 5,
  },

  /* Mood grid */
  moodGrid: {
    flex: 1,
    marginTop: 20,
    gap: 12,
  },
  moodRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  cardWrap: {
    flex: 1,
  },
  cardPressable: {
    flex: 1,
  },
  moodCard: {
    flex: 1,
    minHeight: 64,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: COLORS.soft,
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowOpacity: 0.22,
    elevation: 5,
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.heading,
  },
  selectedLabel: {
    color: COLORS.primary,
  },
  check: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '800',
  },

  /* Bottom */
  bottom: {
    marginTop: 18,
    alignItems: 'center',
    gap: 12,
  },
  footerMessage: {
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 13,
  },
  buttonWrap: {
    width: '100%',
  },
  button: {
    width: '100%',
    paddingVertical: 18,
    backgroundColor: COLORS.primary,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  arrow: {
    position: 'absolute',
    right: 24,
    color: COLORS.white,
    fontSize: 20,
  },
  skip: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    padding: 5,
  },
});