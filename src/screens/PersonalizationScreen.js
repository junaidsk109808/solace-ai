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
  soft: '#E8DEFA',
  tint: '#F3EDFC',
  heading: '#33264D',
  text: '#716982',
  muted: '#958AA8',
  border: '#E9E1F3',
  white: '#FFFFFF',
};

const GOALS = [
  { id: 'stress', title: 'Reduce stress', subtitle: 'Feel more relaxed and peaceful', emoji: '🌿' },
  { id: 'sleep', title: 'Improve sleep', subtitle: 'Build a healthier sleep routine', emoji: '🌙' },
  { id: 'emotions', title: 'Emotional wellbeing', subtitle: 'Feel better emotionally', emoji: '💜' },
  { id: 'habits', title: 'Build healthy habits', subtitle: 'Create positive daily routines', emoji: '🌱' },
  { id: 'understanding', title: 'Understand my emotions', subtitle: 'Learn more about how I feel', emoji: '🧠' },
  { id: 'confidence', title: 'Improve self-confidence', subtitle: 'Believe more in myself', emoji: '✨' },
];

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

/* ----------------------------- Goal card ---------------------------------- */

function GoalCard({ goal, isSelected, showSubtitle, onPress }) {
  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // Pops the emoji and the tick when the card is selected.
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
      onPressIn={() => squish(0.97)}
      onPressOut={() => squish(1)}
    >
      <Animated.View
        style={[
          styles.goalCard,
          isSelected && styles.selectedCard,
          { transform: [{ scale: press }] },
        ]}
      >
        <Animated.View
          style={[
            styles.goalEmoji,
            isSelected && styles.selectedEmoji,
            { transform: [{ scale: lerp(pop, 1, 1.12) }] },
          ]}
        >
          <Text style={styles.goalEmojiText}>{goal.emoji}</Text>
        </Animated.View>

        <View style={styles.goalInfo}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {showSubtitle && <Text style={styles.goalSubtitle}>{goal.subtitle}</Text>}
        </View>

        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
          <Animated.Text
            style={[
              styles.checkmark,
              { opacity: pop, transform: [{ scale: pop }] },
            ]}
          >
            ✓
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------ Screen ----------------------------------- */

export default function PersonalizationScreen({ onContinue, onSkip, onBack }) {
  const { height } = useWindowDimensions();
  const [selectedGoals, setSelectedGoals] = useState([]);

  // Short phones hide some text so everything fits without scrolling.
  const showEmoji = height >= 780;
  const showSubtitle = height >= 700;

  const float = useLoop(2600);
  const arrow = useLoop(900);
  const progress = useRef(new Animated.Value(0)).current;
  const ready = useRef(new Animated.Value(0.45)).current;
  const press = useRef(new Animated.Value(1)).current;

  const count = selectedGoals.length;

  // Progress bar fills up to 50% when the page opens.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Continue button lights up once a goal is picked.
  useEffect(() => {
    Animated.timing(ready, {
      toValue: count > 0 ? 1 : 0.45,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [count, ready]);

  const toggleGoal = (id) => {
    setSelectedGoals((previous) =>
      previous.includes(id)
        ? previous.filter((goal) => goal !== id)
        : [...previous, id]
    );
  };

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
          <FadeIn from={-10} style={styles.backRow}>
            <BackButton onPress={onBack} />
          </FadeIn>
        )}

        <FadeIn from={-10}>
          <View style={styles.topRow}>
            <Text style={styles.stepText}>STEP 2 OF 4</Text>
            <Text style={styles.stepText}>50%</Text>
          </View>

          <View style={styles.progressBackground}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: lerp(progress, '0%', '50%') },
              ]}
            />
          </View>
        </FadeIn>

        <FadeIn delay={150} style={styles.header}>
          {showEmoji && (
            <Animated.Text
              style={[
                styles.emoji,
                { transform: [{ translateY: lerp(float, 3, -6) }] },
              ]}
            >
              🌸
            </Animated.Text>
          )}
          <Text style={styles.title}>What would you like</Text>
          <Text style={styles.title}>to focus on?</Text>
          {showSubtitle && (
            <Text style={styles.subtitle}>
              Choose the areas where you'd like a little support.
              You can select more than one.
            </Text>
          )}
        </FadeIn>

        {/* Goal list stretches to fill the leftover space */}
        <View style={styles.goalsContainer}>
          {GOALS.map((goal, index) => (
            <FadeIn
              key={goal.id}
              delay={300 + index * 90}
              from={18}
              style={styles.cardWrap}
            >
              <GoalCard
                goal={goal}
                isSelected={selectedGoals.includes(goal.id)}
                showSubtitle={showSubtitle}
                onPress={() => toggleGoal(goal.id)}
              />
            </FadeIn>
          ))}
        </View>

        <FadeIn delay={900} style={styles.bottom}>
          <Text style={styles.selectionText}>
            {count === 0
              ? 'Select at least one area to continue'
              : `${count} ${count === 1 ? 'goal' : 'goals'} selected`}
          </Text>

          <Pressable
            style={styles.buttonWrap}
            onPress={() => onContinue?.(selectedGoals)}
            onPressIn={() => count > 0 && squish(0.96)}
            onPressOut={() => squish(1)}
            disabled={count === 0}
          >
            <Animated.View
              style={[
                styles.continueButton,
                { opacity: ready, transform: [{ scale: press }] },
              ]}
            >
              <Text style={styles.continueText}>Continue</Text>
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
            <Text style={styles.skipText}>I'll do this later</Text>
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
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
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

  /* Progress */
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  progressBackground: {
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

  /* Header */
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 38,
    marginBottom: 10,
  },
  title: {
    color: COLORS.heading,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 8,
  },

  /* Goals */
  goalsContainer: {
    flex: 1,
    gap: 10,
  },
  cardWrap: {
    flex: 1,
  },
  cardPressable: {
    flex: 1,
  },
  goalCard: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.tint,
    shadowOpacity: 0.2,
    elevation: 4,
  },
  goalEmoji: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedEmoji: {
    backgroundColor: COLORS.soft,
  },
  goalEmojiText: {
    fontSize: 21,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    color: COLORS.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  goalSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  /* Bottom */
  bottom: {
    marginTop: 14,
    alignItems: 'center',
    gap: 12,
  },
  selectionText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  buttonWrap: {
    width: '100%',
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  continueText: {
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
  skipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 5,
  },
});