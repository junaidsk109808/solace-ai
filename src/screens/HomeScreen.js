import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Pressable,
    StatusBar,
    Modal,
    TextInput,
    Animated,
    Easing,
    Platform,
    useWindowDimensions,
    KeyboardAvoidingView,
} from 'react-native';

/* ==========================================================================
   COLOR SYSTEM
   ========================================================================== */
const COLORS = {
    background: '#F9F6FF',
    surface: '#FFFFFF',
    primary: '#8665BD',
    primaryDark: '#7050A5',
    secondary: '#B69ADD',
    soft: '#E8DEFA',
    heading: '#33264D',
    text: '#716982',
    secondaryText: '#958AA8',
    muted: '#B3A9C0',
    border: '#E9E1F3',
    softCard: '#F3EEFB',
    inputBg: '#F9F6FF',

    // Supporting Pastels
    mint: '#DFF3EA',
    mintDark: '#4A9878',
    peach: '#FCE9DE',
    peachDark: '#D2764B',
    yellow: '#FFF2D6',
    yellowDark: '#B8861B',
    pink: '#F9E4ED',
    pinkDark: '#C25586',
    blue: '#E5EEFC',
    blueDark: '#4F7EC4',
};

/* ==========================================================================
   STATIC DATA & CONFIG
   ========================================================================== */
const MOOD_OPTIONS = [
    { id: 'happy', label: 'Happy', emoji: '😊', bg: COLORS.yellow, accent: COLORS.yellowDark },
    { id: 'calm', label: 'Calm', emoji: '😌', bg: COLORS.mint, accent: COLORS.mintDark },
    { id: 'sad', label: 'Sad', emoji: '😔', bg: COLORS.blue, accent: COLORS.blueDark },
    { id: 'anxious', label: 'Anxious', emoji: '😰', bg: COLORS.peach, accent: COLORS.peachDark },
    { id: 'tired', label: 'Tired', emoji: '😴', bg: COLORS.soft, accent: COLORS.primaryDark },
    { id: 'stressed', label: 'Stressed', emoji: '😣', bg: COLORS.pink, accent: COLORS.pinkDark },
];

const DEFAULT_REMINDERS = [
    { id: 'breathe', title: 'Mindful breathing', time: '9:00 AM', desc: 'Take a mindful breathing break', icon: '🫧', enabled: true },
    { id: 'water', title: 'Hydration check', time: '11:00 AM', desc: 'Drink some water and refresh', icon: '💧', enabled: true },
    { id: 'break', title: 'Rest & pause', time: '1:00 PM', desc: 'Give yourself a short rest', icon: '☕', enabled: false },
    { id: 'stretch', title: 'Stretch & move', time: '4:00 PM', desc: 'Gentle movement for your body', icon: '🧘', enabled: true },
    { id: 'relax', title: 'Evening unwind', time: '7:00 PM', desc: 'Relax and release the day', icon: '🌿', enabled: false },
    { id: 'sleep', title: 'Sleep routine', time: '10:00 PM', desc: 'Prepare for restful sleep', icon: '🌙', enabled: true },
];

const DEFAULT_CHECKLIST = [
    { id: 'water', label: 'Drink enough water', icon: '💧', completed: false },
    { id: 'walk', label: 'Take a short walk', icon: '🚶', completed: false },
    { id: 'stretch', label: 'Stretch your body', icon: '🧘', completed: false },
    { id: 'screen', label: 'Take a screen break', icon: '🌿', completed: false },
    { id: 'thoughts', label: 'Write down your thoughts', icon: '✍️', completed: false },
    { id: 'gratitude', label: 'Practice gratitude', icon: '♡', completed: false },
    { id: 'enjoy', label: 'Spend time doing something you enjoy', icon: '✨', completed: false },
    { id: 'relax', label: 'Take a moment to relax', icon: '☕', completed: false },
];

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */
export default function HomeScreen({
    user,
    onOpenCompanion,
    onOpenProgress,
    onOpenProfile,
}) {
    const { width } = useWindowDimensions();
    const isSmallPhone = width < 360;

    // Greeting state
    const [greetingTime, setGreetingTime] = useState(getTimeGreeting);
    useEffect(() => {
        const timer = setInterval(() => setGreetingTime(getTimeGreeting()), 60000);
        return () => clearInterval(timer);
    }, []);

    const firstName =
        user?.user_metadata?.full_name?.split(' ')[0] ||
        user?.user_metadata?.name?.split(' ')[0] ||
        '';

    // 1. Mood State
    const [selectedMood, setSelectedMood] = useState(null);
    const [moodSaved, setMoodSaved] = useState(false);
    const moodScaleAnim = useRef(new Animated.Value(1)).current;

    // 2. Reminders State
    const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
    const [remindersModalVisible, setRemindersModalVisible] = useState(false);
    const [editingReminderId, setEditingReminderId] = useState(null);
    const [tempReminderTime, setTempReminderTime] = useState('');

    // 3. Breathing State
    const [breathingDuration, setBreathingDuration] = useState(1); // minutes
    const [breathingActive, setBreathingActive] = useState(false);
    const [breathingPaused, setBreathingPaused] = useState(false);
    const [breathingSecondsLeft, setBreathingSecondsLeft] = useState(60);
    const [breathPhase, setBreathPhase] = useState('Inhale'); // Inhale, Hold, Exhale
    const [breathingCompletedCount, setBreathingCompletedCount] = useState(0);
    const [breathingFinishedMsg, setBreathingFinishedMsg] = useState(false);

    const breathAnim = useRef(new Animated.Value(1)).current;
    const breathingTimerRef = useRef(null);

    // 4. Self-care Checklist State
    const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

    // 5. Wellness Tools Modals
    const [activeToolModal, setActiveToolModal] = useState(null); // 'journal' | 'gratitude' | 'meditation' | 'sleep'

    // Tool Specific States
    const [journalEntries, setJournalEntries] = useState([]);
    const [journalTitle, setJournalTitle] = useState('');
    const [journalText, setJournalText] = useState('');

    const [gratitudeEntries, setGratitudeEntries] = useState([]);
    const [gratitude1, setGratitude1] = useState('');
    const [gratitude2, setGratitude2] = useState('');
    const [gratitude3, setGratitude3] = useState('');

    const [meditationActive, setMeditationActive] = useState(false);
    const [meditationTimer, setMeditationTimer] = useState(180); // 3 minutes default

    const [sleepChecklist, setSleepChecklist] = useState([
        { id: 'screens', label: 'Turn off screens 30 mins before bed', done: false },
        { id: 'herbal', label: 'Sip warm water or caffeine-free tea', done: false },
        { id: 'lights', label: 'Dim bedroom lights and relax', done: false },
        { id: 'reading', label: 'Read a gentle book or journal', done: false },
    ]);

    /* --------------------------------------------------------------------------
       BREATHING ANIMATION & TIMER LOGIC
       -------------------------------------------------------------------------- */
    useEffect(() => {
        let phaseInterval = null;

        if (breathingActive && !breathingPaused && breathingSecondsLeft > 0) {
            // Cycle: Inhale (4s) -> Hold (4s) -> Exhale (4s)
            const runCycle = () => {
                setBreathPhase('Inhale');
                Animated.timing(breathAnim, {
                    toValue: 1.35,
                    duration: 4000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }).start(() => {
                    setBreathPhase('Hold');
                    setTimeout(() => {
                        setBreathPhase('Exhale');
                        Animated.timing(breathAnim, {
                            toValue: 1.0,
                            duration: 4000,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }).start();
                    }, 4000);
                });
            };

            runCycle();
            phaseInterval = setInterval(runCycle, 12000);

            breathingTimerRef.current = setInterval(() => {
                setBreathingSecondsLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(breathingTimerRef.current);
                        clearInterval(phaseInterval);
                        setBreathingActive(false);
                        setBreathingCompletedCount((c) => c + 1);
                        setBreathingFinishedMsg(true);
                        Animated.spring(breathAnim, { toValue: 1, useNativeDriver: true }).start();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            Animated.spring(breathAnim, { toValue: 1, useNativeDriver: true }).start();
        }

        return () => {
            if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
            if (phaseInterval) clearInterval(phaseInterval);
        };
    }, [breathingActive, breathingPaused]);

    const startBreathing = () => {
        setBreathingFinishedMsg(false);
        setBreathingSecondsLeft(breathingDuration * 60);
        setBreathingPaused(false);
        setBreathingActive(true);
    };

    const stopBreathing = () => {
        setBreathingActive(false);
        setBreathingPaused(false);
        setBreathingSecondsLeft(breathingDuration * 60);
        setBreathPhase('Inhale');
    };

    const togglePauseBreathing = () => {
        setBreathingPaused((prev) => !prev);
    };

    /* --------------------------------------------------------------------------
       MOOD ACTIONS
       -------------------------------------------------------------------------- */
    const handleSelectMood = (moodId) => {
        setSelectedMood(moodId);
        setMoodSaved(false);

        // Gentle scale pop
        Animated.sequence([
            Animated.timing(moodScaleAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
            Animated.spring(moodScaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
    };

    const handleSaveMood = () => {
        if (!selectedMood) return;
        setMoodSaved(true);
    };

    /* --------------------------------------------------------------------------
       CHECKLIST ACTIONS
       -------------------------------------------------------------------------- */
    const toggleChecklistItem = (id) => {
        setChecklist((prev) =>
            prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
        );
    };

    const completedChecklistCount = checklist.filter((item) => item.completed).length;

    /* --------------------------------------------------------------------------
       REMINDERS ACTIONS
       -------------------------------------------------------------------------- */
    const toggleReminder = (id) => {
        setReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
        );
    };

    const saveReminderTime = () => {
        if (!editingReminderId || !tempReminderTime.trim()) return;
        setReminders((prev) =>
            prev.map((r) => (r.id === editingReminderId ? { ...r, time: tempReminderTime.trim() } : r))
        );
        setEditingReminderId(null);
        setTempReminderTime('');
    };

    /* --------------------------------------------------------------------------
       WELLNESS TOOLS ACTIONS
       -------------------------------------------------------------------------- */
    const handleSaveJournal = () => {
        if (!journalText.trim()) return;
        const newEntry = {
            id: Date.now().toString(),
            title: journalTitle.trim() || 'Daily Reflection',
            text: journalText.trim(),
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setJournalEntries([newEntry, ...journalEntries]);
        setJournalTitle('');
        setJournalText('');
        setActiveToolModal(null);
    };

    const handleSaveGratitude = () => {
        const items = [gratitude1.trim(), gratitude2.trim(), gratitude3.trim()].filter(Boolean);
        if (items.length === 0) return;
        setGratitudeEntries([
            { id: Date.now().toString(), items, date: new Date().toLocaleDateString() },
            ...gratitudeEntries,
        ]);
        setGratitude1('');
        setGratitude2('');
        setGratitude3('');
        setActiveToolModal(null);
    };

    const totalJournalAndGratitude = journalEntries.length + gratitudeEntries.length;
    const hasAnyProgress =
        selectedMood ||
        completedChecklistCount > 0 ||
        breathingCompletedCount > 0 ||
        totalJournalAndGratitude > 0;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ==========================================================
                    SECTION 1: HEADER & GREETING
                    ========================================================== */}
                <View style={styles.header}>
                    <View style={styles.brandRow}>
                        <View style={styles.logoBadge}>
                            <Text style={styles.logoSymbol}>✦</Text>
                        </View>
                        <Text style={styles.brandText}>
                            solace<Text style={{ color: COLORS.primary }}>.</Text>
                        </Text>
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.profileAvatar, pressed && styles.pressedScale]}
                        onPress={onOpenProfile}
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                    >
                        <Text style={styles.profileAvatarText}>
                            {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || '☺'}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.greetingContainer}>
                    <Text style={styles.greetingTitle}>
                        {greetingTime}{firstName ? `, ${firstName}` : ''} 💜
                    </Text>
                    <Text style={styles.greetingSubtitle}>
                        Take a moment for yourself today.
                    </Text>
                </View>

                {/* ==========================================================
                    SECTION 2: DAILY MOOD CHECK-IN
                    ========================================================== */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>How are you feeling today?</Text>
                        <Text style={styles.sectionSubtitle}>
                            Every feeling deserves to be understood.
                        </Text>
                    </View>

                    <View style={styles.moodGrid}>
                        {MOOD_OPTIONS.map((item) => {
                            const isSelected = selectedMood === item.id;
                            return (
                                <Pressable
                                    key={item.id}
                                    style={({ pressed }) => [
                                        styles.moodCard,
                                        { backgroundColor: isSelected ? COLORS.softCard : item.bg },
                                        isSelected && styles.moodCardSelected,
                                        isSmallPhone && styles.moodCardSmall,
                                        pressed && styles.pressedScale,
                                    ]}
                                    onPress={() => handleSelectMood(item.id)}
                                >
                                    <Animated.View
                                        style={[
                                            styles.moodCardContent,
                                            isSelected && { transform: [{ scale: moodScaleAnim }] },
                                        ]}
                                    >
                                        <Text style={styles.moodEmoji}>{item.emoji}</Text>
                                        <Text
                                            style={[
                                                styles.moodLabel,
                                                isSelected && styles.moodLabelSelected,
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </Animated.View>
                                </Pressable>
                            );
                        })}
                    </View>

                    {selectedMood && (
                        <View style={styles.moodActionRow}>
                            <View style={styles.currentMoodBadge}>
                                <Text style={styles.currentMoodText}>
                                    Feeling{' '}
                                    <Text style={{ fontWeight: '700', color: COLORS.primaryDark }}>
                                        {MOOD_OPTIONS.find((m) => m.id === selectedMood)?.label}
                                    </Text>{' '}
                                    {MOOD_OPTIONS.find((m) => m.id === selectedMood)?.emoji}
                                </Text>
                            </View>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.saveMoodBtn,
                                    moodSaved && styles.saveMoodBtnSaved,
                                    pressed && styles.pressedScale,
                                ]}
                                onPress={handleSaveMood}
                            >
                                <Text
                                    style={[
                                        styles.saveMoodBtnText,
                                        moodSaved && styles.saveMoodBtnTextSaved,
                                    ]}
                                >
                                    {moodSaved ? '✓ Saved for Today' : 'Save Mood'}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* ==========================================================
                    SECTION 3: AI COMPANION HERO CARD
                    ========================================================== */}
                <Pressable
                    style={({ pressed }) => [styles.heroCard, pressed && styles.pressedScale]}
                    onPress={onOpenCompanion}
                    accessibilityRole="button"
                    accessibilityLabel="Talk to Solace"
                >
                    <View style={styles.heroBackgroundBlob} />
                    <View style={styles.heroContent}>
                        <View style={styles.heroTagRow}>
                            <Text style={styles.heroTagText}>✦ YOUR PERSONAL AI COMPANION</Text>
                        </View>

                        <Text style={styles.heroHeading}>Talk to Solace</Text>
                        <Text style={styles.heroDescription}>
                            I'm here whenever you need someone to listen, guide, or comfort you.
                        </Text>

                        <View style={styles.heroCtaRow}>
                            <Text style={styles.heroCtaText}>Start a conversation  →</Text>
                        </View>
                    </View>

                    <View style={styles.heroIconCircle}>
                        <Text style={styles.heroSparkle}>✦</Text>
                    </View>
                </Pressable>

                {/* ==========================================================
                    SECTION 4: DAILY WELLNESS REMINDERS
                    ========================================================== */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Your daily reminders</Text>
                            <Text style={styles.sectionSubtitle}>
                                Little reminders to take care of yourself.
                            </Text>
                        </View>
                        <Pressable
                            style={styles.manageBtn}
                            onPress={() => setRemindersModalVisible(true)}
                        >
                            <Text style={styles.manageBtnText}>Manage</Text>
                        </Pressable>
                    </View>

                    <View style={styles.remindersList}>
                        {reminders.map((reminder) => (
                            <View
                                key={reminder.id}
                                style={[
                                    styles.reminderCard,
                                    !reminder.enabled && styles.reminderCardDisabled,
                                ]}
                            >
                                <View style={styles.reminderIconWrap}>
                                    <Text style={styles.reminderIconText}>{reminder.icon}</Text>
                                </View>

                                <View style={styles.reminderInfo}>
                                    <View style={styles.reminderTitleRow}>
                                        <Text style={styles.reminderTitle}>{reminder.title}</Text>
                                        <Text style={styles.reminderTime}>{reminder.time}</Text>
                                    </View>
                                    <Text style={styles.reminderDesc} numberOfLines={1}>
                                        {reminder.desc}
                                    </Text>
                                </View>

                                <Pressable
                                    onPress={() => toggleReminder(reminder.id)}
                                    style={[
                                        styles.toggleSwitch,
                                        reminder.enabled && styles.toggleSwitchActive,
                                    ]}
                                    hitSlop={8}
                                >
                                    <View
                                        style={[
                                            styles.toggleThumb,
                                            reminder.enabled && styles.toggleThumbActive,
                                        ]}
                                    />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ==========================================================
                    SECTION 5: BREATHING EXERCISES
                    ========================================================== */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Take a mindful breath</Text>
                        <Text style={styles.sectionSubtitle}>
                            Slow down, relax and reconnect with yourself.
                        </Text>
                    </View>

                    {/* Duration Selectors */}
                    <View style={styles.breathingPillsRow}>
                        {[1, 3, 5].map((mins) => (
                            <Pressable
                                key={mins}
                                disabled={breathingActive}
                                style={[
                                    styles.durationPill,
                                    breathingDuration === mins && styles.durationPillActive,
                                ]}
                                onPress={() => {
                                    setBreathingDuration(mins);
                                    setBreathingSecondsLeft(mins * 60);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.durationPillText,
                                        breathingDuration === mins && styles.durationPillTextActive,
                                    ]}
                                >
                                    {mins} min{mins > 1 ? 's' : ''}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Breathing Visualizer */}
                    <View style={styles.breathingVisualContainer}>
                        <Animated.View
                            style={[
                                styles.breathingHalo,
                                {
                                    transform: [{ scale: breathAnim }],
                                },
                            ]}
                        >
                            <View style={styles.breathingCore}>
                                <Text style={styles.breathingPhaseText}>
                                    {breathingActive ? breathPhase : 'Ready'}
                                </Text>
                                <Text style={styles.breathingTimerText}>
                                    {Math.floor(breathingSecondsLeft / 60)}:
                                    {breathingSecondsLeft % 60 < 10 ? '0' : ''}
                                    {breathingSecondsLeft % 60}
                                </Text>
                            </View>
                        </Animated.View>
                    </View>

                    {/* Completion Message */}
                    {breathingFinishedMsg && (
                        <View style={styles.finishedBadge}>
                            <Text style={styles.finishedBadgeText}>
                                🌿 Wonderful! Take this calm with you.
                            </Text>
                        </View>
                    )}

                    {/* Controls */}
                    <View style={styles.breathingControlsRow}>
                        {!breathingActive ? (
                            <Pressable
                                style={({ pressed }) => [styles.breathingMainBtn, pressed && styles.pressedScale]}
                                onPress={startBreathing}
                            >
                                <Text style={styles.breathingMainBtnText}>Start Breathing</Text>
                            </Pressable>
                        ) : (
                            <View style={styles.activeControlsGroup}>
                                <Pressable
                                    style={[styles.breathingSecondaryBtn, styles.pauseBtn]}
                                    onPress={togglePauseBreathing}
                                >
                                    <Text style={styles.pauseBtnText}>
                                        {breathingPaused ? 'Resume' : 'Pause'}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.breathingSecondaryBtn, styles.endBtn]}
                                    onPress={stopBreathing}
                                >
                                    <Text style={styles.endBtnText}>End</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </View>

                {/* ==========================================================
                    SECTION 6: DAILY SELF-CARE CHECKLIST
                    ========================================================== */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Your little self-care steps</Text>
                            <Text style={styles.sectionSubtitle}>
                                Small habits can make a meaningful difference.
                            </Text>
                        </View>
                        <View style={styles.checklistBadge}>
                            <Text style={styles.checklistBadgeText}>
                                {completedChecklistCount}/{checklist.length}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarTrack}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${(completedChecklistCount / checklist.length) * 100}%` },
                            ]}
                        />
                    </View>

                    <View style={styles.checklistGrid}>
                        {checklist.map((item) => (
                            <Pressable
                                key={item.id}
                                style={({ pressed }) => [
                                    styles.checklistItem,
                                    item.completed && styles.checklistItemCompleted,
                                    pressed && styles.pressedScale,
                                ]}
                                onPress={() => toggleChecklistItem(item.id)}
                            >
                                <View style={styles.checklistIconWrap}>
                                    <Text style={styles.checklistEmoji}>{item.icon}</Text>
                                </View>

                                <Text
                                    style={[
                                        styles.checklistLabel,
                                        item.completed && styles.checklistLabelCompleted,
                                    ]}
                                >
                                    {item.label}
                                </Text>

                                <View
                                    style={[
                                        styles.checkboxCircle,
                                        item.completed && styles.checkboxCircleCompleted,
                                    ]}
                                >
                                    {item.completed && <Text style={styles.checkMark}>✓</Text>}
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* ==========================================================
                    SECTION 7: WELLNESS TOOLS (2-Column Grid)
                    ========================================================== */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Explore your wellbeing</Text>
                        <Text style={styles.sectionSubtitle}>
                            A little time for yourself can go a long way.
                        </Text>
                    </View>

                    <View style={styles.toolsGrid}>
                        {/* 1. Daily Journal */}
                        <Pressable
                            style={({ pressed }) => [styles.toolCard, pressed && styles.pressedScale]}
                            onPress={() => setActiveToolModal('journal')}
                        >
                            <View style={[styles.toolIconWrap, { backgroundColor: COLORS.yellow }]}>
                                <Text style={styles.toolIconText}>📖</Text>
                            </View>
                            <Text style={styles.toolTitle}>Daily Journal</Text>
                            <Text style={styles.toolDesc}>Write your thoughts and feelings freely.</Text>
                            <Text style={styles.toolActionText}>Open Journal →</Text>
                        </Pressable>

                        {/* 2. Gratitude Practice */}
                        <Pressable
                            style={({ pressed }) => [styles.toolCard, pressed && styles.pressedScale]}
                            onPress={() => setActiveToolModal('gratitude')}
                        >
                            <View style={[styles.toolIconWrap, { backgroundColor: COLORS.pink }]}>
                                <Text style={styles.toolIconText}>♡</Text>
                            </View>
                            <Text style={styles.toolTitle}>Gratitude</Text>
                            <Text style={styles.toolDesc}>Write 3 things you appreciate today.</Text>
                            <Text style={styles.toolActionText}>Reflect →</Text>
                        </Pressable>

                        {/* 3. Meditation */}
                        <Pressable
                            style={({ pressed }) => [styles.toolCard, pressed && styles.pressedScale]}
                            onPress={() => setActiveToolModal('meditation')}
                        >
                            <View style={[styles.toolIconWrap, { backgroundColor: COLORS.mint }]}>
                                <Text style={styles.toolIconText}>🧘</Text>
                            </View>
                            <Text style={styles.toolTitle}>Meditation</Text>
                            <Text style={styles.toolDesc}>Short guided mindfulness sessions.</Text>
                            <Text style={styles.toolActionText}>Begin →</Text>
                        </Pressable>

                        {/* 4. Sleep Wellness */}
                        <Pressable
                            style={({ pressed }) => [styles.toolCard, pressed && styles.pressedScale]}
                            onPress={() => setActiveToolModal('sleep')}
                        >
                            <View style={[styles.toolIconWrap, { backgroundColor: COLORS.blue }]}>
                                <Text style={styles.toolIconText}>🌙</Text>
                            </View>
                            <Text style={styles.toolTitle}>Sleep Well</Text>
                            <Text style={styles.toolDesc}>Relaxing tips and bedtime routine.</Text>
                            <Text style={styles.toolActionText}>Explore →</Text>
                        </Pressable>
                    </View>
                </View>

                {/* ==========================================================
                    SECTION 8: WELLNESS PROGRESS
                    ========================================================== */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Your wellness journey</Text>
                            <Text style={styles.sectionSubtitle}>Every small step matters.</Text>
                        </View>
                        {onOpenProgress && (
                            <Pressable style={styles.viewProgressBtn} onPress={onOpenProgress}>
                                <Text style={styles.viewProgressBtnText}>View stats</Text>
                            </Pressable>
                        )}
                    </View>

                    {!hasAnyProgress ? (
                        <View style={styles.emptyProgressBox}>
                            <Text style={styles.emptyProgressEmoji}>🌱</Text>
                            <Text style={styles.emptyProgressText}>
                                Your wellness journey starts with one small step.
                            </Text>
                            <Text style={styles.emptyProgressSubtext}>
                                Complete a mood check-in or a self-care habit to see your progress here.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.progressMetricsGrid}>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricVal}>
                                    {selectedMood ? MOOD_OPTIONS.find((m) => m.id === selectedMood)?.emoji : '—'}
                                </Text>
                                <Text style={styles.metricLabel}>Today's Mood</Text>
                                <Text style={styles.metricSub}>
                                    {selectedMood ? MOOD_OPTIONS.find((m) => m.id === selectedMood)?.label : 'Not set'}
                                </Text>
                            </View>

                            <View style={styles.metricCard}>
                                <Text style={styles.metricVal}>
                                    {completedChecklistCount}
                                    <Text style={styles.metricValTotal}>/{checklist.length}</Text>
                                </Text>
                                <Text style={styles.metricLabel}>Self-Care</Text>
                                <Text style={styles.metricSub}>Habits done</Text>
                            </View>

                            <View style={styles.metricCard}>
                                <Text style={styles.metricVal}>{breathingCompletedCount}</Text>
                                <Text style={styles.metricLabel}>Breathing</Text>
                                <Text style={styles.metricSub}>Sessions done</Text>
                            </View>

                            <View style={styles.metricCard}>
                                <Text style={styles.metricVal}>{totalJournalAndGratitude}</Text>
                                <Text style={styles.metricLabel}>Reflections</Text>
                                <Text style={styles.metricSub}>Entries logged</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* ==========================================================
                    SECTION 9: FOOTER
                    ========================================================== */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>
                        Be kind to yourself. You're doing better than you think. 💜
                    </Text>
                </View>
            </ScrollView>

            {/* ==========================================================
                MODALS FOR TOOLS & REMINDERS
                ========================================================== */}

            {/* --- MANAGE REMINDERS MODAL --- */}
            <Modal
                visible={remindersModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setRemindersModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manage Reminders</Text>
                            <Pressable
                                onPress={() => setRemindersModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.modalNote}>
                            Configure your daily self-care cues. (Local preferences)
                        </Text>

                        <ScrollView style={{ maxHeight: 360 }}>
                            {reminders.map((r) => (
                                <View key={r.id} style={styles.manageReminderRow}>
                                    <View style={styles.manageReminderInfo}>
                                        <Text style={styles.manageReminderTitle}>
                                            {r.icon} {r.title}
                                        </Text>
                                        {editingReminderId === r.id ? (
                                            <View style={styles.timeEditRow}>
                                                <TextInput
                                                    style={styles.timeInput}
                                                    value={tempReminderTime}
                                                    onChangeText={setTempReminderTime}
                                                    placeholder="e.g. 8:30 AM"
                                                    autoFocus
                                                />
                                                <Pressable
                                                    style={styles.saveTimeBtn}
                                                    onPress={saveReminderTime}
                                                >
                                                    <Text style={styles.saveTimeBtnText}>Save</Text>
                                                </Pressable>
                                            </View>
                                        ) : (
                                            <Pressable
                                                onPress={() => {
                                                    setEditingReminderId(r.id);
                                                    setTempReminderTime(r.time);
                                                }}
                                            >
                                                <Text style={styles.manageReminderTime}>
                                                    {r.time} ✎
                                                </Text>
                                            </Pressable>
                                        )}
                                    </View>

                                    <Pressable
                                        onPress={() => toggleReminder(r.id)}
                                        style={[
                                            styles.toggleSwitch,
                                            r.enabled && styles.toggleSwitchActive,
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.toggleThumb,
                                                r.enabled && styles.toggleThumbActive,
                                            ]}
                                        />
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- DAILY JOURNAL MODAL --- */}
            <Modal
                visible={activeToolModal === 'journal'}
                animationType="slide"
                transparent
                onRequestClose={() => setActiveToolModal(null)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Daily Journal</Text>
                            <Pressable
                                onPress={() => setActiveToolModal(null)}
                                style={styles.modalCloseBtn}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.modalNote}>
                            Write down whatever is on your mind. This is your safe space.
                        </Text>

                        <TextInput
                            style={styles.journalTitleInput}
                            placeholder="Entry title (optional)"
                            placeholderTextColor={COLORS.muted}
                            value={journalTitle}
                            onChangeText={setJournalTitle}
                        />

                        <TextInput
                            style={styles.journalTextInput}
                            placeholder="How was your day? What are you holding right now?"
                            placeholderTextColor={COLORS.muted}
                            value={journalText}
                            onChangeText={setJournalText}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />

                        <Pressable style={styles.modalActionBtn} onPress={handleSaveJournal}>
                            <Text style={styles.modalActionBtnText}>Save Journal Entry</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- GRATITUDE MODAL --- */}
            <Modal
                visible={activeToolModal === 'gratitude'}
                animationType="slide"
                transparent
                onRequestClose={() => setActiveToolModal(null)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Gratitude Practice</Text>
                            <Pressable
                                onPress={() => setActiveToolModal(null)}
                                style={styles.modalCloseBtn}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.modalNote}>
                            Pause and name three simple things you appreciate today.
                        </Text>

                        <TextInput
                            style={styles.gratitudeInput}
                            placeholder="1. A small joy or comfort..."
                            placeholderTextColor={COLORS.muted}
                            value={gratitude1}
                            onChangeText={setGratitude1}
                        />
                        <TextInput
                            style={styles.gratitudeInput}
                            placeholder="2. Someone or something you're thankful for..."
                            placeholderTextColor={COLORS.muted}
                            value={gratitude2}
                            onChangeText={setGratitude2}
                        />
                        <TextInput
                            style={styles.gratitudeInput}
                            placeholder="3. A gift of this moment..."
                            placeholderTextColor={COLORS.muted}
                            value={gratitude3}
                            onChangeText={setGratitude3}
                        />

                        <Pressable style={styles.modalActionBtn} onPress={handleSaveGratitude}>
                            <Text style={styles.modalActionBtnText}>Save Gratitude</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- MEDITATION MODAL --- */}
            <Modal
                visible={activeToolModal === 'meditation'}
                animationType="slide"
                transparent
                onRequestClose={() => setActiveToolModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Mindfulness Session</Text>
                            <Pressable
                                onPress={() => setActiveToolModal(null)}
                                style={styles.modalCloseBtn}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <View style={styles.meditationVisual}>
                            <Text style={styles.meditationIcon}>🌸</Text>
                            <Text style={styles.meditationInstruction}>
                                Soften your shoulders. Close your eyes gently. Notice the ambient sounds around you.
                            </Text>
                            <Text style={styles.meditationTimerText}>
                                {Math.floor(meditationTimer / 60)}:
                                {meditationTimer % 60 < 10 ? '0' : ''}
                                {meditationTimer % 60}
                            </Text>
                        </View>

                        <Pressable
                            style={styles.modalActionBtn}
                            onPress={() => {
                                setMeditationActive(!meditationActive);
                                if (!meditationActive) {
                                    setBreathingCompletedCount((c) => c + 1);
                                }
                            }}
                        >
                            <Text style={styles.modalActionBtnText}>
                                {meditationActive ? 'Pause Session' : 'Begin 3-Min Meditation'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* --- SLEEP WELLNESS MODAL --- */}
            <Modal
                visible={activeToolModal === 'sleep'}
                animationType="slide"
                transparent
                onRequestClose={() => setActiveToolModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Bedtime Preparation</Text>
                            <Pressable
                                onPress={() => setActiveToolModal(null)}
                                style={styles.modalCloseBtn}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.modalNote}>
                            A calm evening routine tells your nervous system it's safe to rest.
                        </Text>

                        {sleepChecklist.map((item) => (
                            <Pressable
                                key={item.id}
                                style={styles.sleepRow}
                                onPress={() => {
                                    setSleepChecklist((prev) =>
                                        prev.map((s) => (s.id === item.id ? { ...s, done: !s.done } : s))
                                    );
                                }}
                            >
                                <View
                                    style={[
                                        styles.checkboxCircle,
                                        item.done && styles.checkboxCircleCompleted,
                                    ]}
                                >
                                    {item.done && <Text style={styles.checkMark}>✓</Text>}
                                </View>
                                <Text
                                    style={[
                                        styles.sleepLabel,
                                        item.done && styles.checklistLabelCompleted,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}

                        <Pressable
                            style={[styles.modalActionBtn, { marginTop: 18 }]}
                            onPress={() => setActiveToolModal(null)}
                        >
                            <Text style={styles.modalActionBtnText}>Done for Tonight</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/* ==========================================================================
   STYLES
   ========================================================================== */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 14 : 10,
        paddingBottom: 40,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
    },
    pressedScale: {
        opacity: 0.88,
        transform: [{ scale: 0.98 }],
    },

    /* 1. Header */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoBadge: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOpacity: 0.22,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    logoSymbol: {
        color: '#FFFFFF',
        fontSize: 20,
    },
    brandText: {
        fontSize: 25,
        fontWeight: '800',
        letterSpacing: -0.8,
        color: COLORS.heading,
    },
    profileAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.soft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.surface,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    profileAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
    greetingContainer: {
        marginTop: 18,
        marginBottom: 20,
    },
    greetingTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.5,
        color: COLORS.heading,
    },
    greetingSubtitle: {
        fontSize: 14,
        color: COLORS.text,
        marginTop: 6,
    },

    /* Reusable Section Card & Headings */
    sectionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.3,
        color: COLORS.heading,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: COLORS.text,
        marginTop: 4,
    },

    /* 2. Mood Grid */
    moodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
    },
    moodCard: {
        width: '31%',
        paddingVertical: 14,
        paddingHorizontal: 6,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    moodCardSmall: {
        width: '30%',
    },
    moodCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.softCard,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    moodCardContent: {
        alignItems: 'center',
    },
    moodEmoji: {
        fontSize: 27,
        marginBottom: 6,
    },
    moodLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.heading,
    },
    moodLabelSelected: {
        color: COLORS.primaryDark,
        fontWeight: '800',
    },
    moodActionRow: {
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    currentMoodBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    currentMoodText: {
        fontSize: 13,
        color: COLORS.text,
    },
    saveMoodBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 14,
    },
    saveMoodBtnSaved: {
        backgroundColor: COLORS.mint,
    },
    saveMoodBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    saveMoodBtnTextSaved: {
        color: COLORS.mintDark,
    },

    /* 3. Hero Card */
    heroCard: {
        backgroundColor: COLORS.primary,
        borderRadius: 26,
        padding: 22,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroBackgroundBlob: {
        position: 'absolute',
        right: -30,
        bottom: -30,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    heroContent: {
        flex: 1,
        paddingRight: 10,
    },
    heroTagRow: {
        marginBottom: 6,
    },
    heroTagText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        color: COLORS.soft,
    },
    heroHeading: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.4,
    },
    heroDescription: {
        fontSize: 13,
        color: '#F4EDFC',
        lineHeight: 18,
        marginTop: 6,
    },
    heroCtaRow: {
        marginTop: 14,
    },
    heroCtaText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    heroIconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroSparkle: {
        fontSize: 30,
        color: '#FFFFFF',
    },

    /* 4. Reminders */
    manageBtn: {
        backgroundColor: COLORS.soft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    manageBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
    remindersList: {
        gap: 10,
    },
    reminderCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    reminderCardDisabled: {
        opacity: 0.6,
    },
    reminderIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    reminderIconText: {
        fontSize: 18,
    },
    reminderInfo: {
        flex: 1,
    },
    reminderTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: 12,
    },
    reminderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.heading,
    },
    reminderTime: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.primaryDark,
    },
    reminderDesc: {
        fontSize: 12,
        color: COLORS.secondaryText,
        marginTop: 3,
    },
    toggleSwitch: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.border,
        padding: 2,
        justifyContent: 'center',
    },
    toggleSwitchActive: {
        backgroundColor: COLORS.primary,
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },

    /* 5. Breathing Card */
    breathingPillsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    durationPill: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    durationPillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    durationPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.text,
    },
    durationPillTextActive: {
        color: '#FFFFFF',
    },
    breathingVisualContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 190,
    },
    breathingHalo: {
        width: 145,
        height: 145,
        borderRadius: 72.5,
        backgroundColor: COLORS.soft,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 3,
    },
    breathingCore: {
        width: 105,
        height: 105,
        borderRadius: 52.5,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    breathingPhaseText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    breathingTimerText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.soft,
        marginTop: 4,
    },
    finishedBadge: {
        backgroundColor: COLORS.mint,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 14,
        alignSelf: 'center',
        marginTop: 10,
    },
    finishedBadgeText: {
        color: COLORS.mintDark,
        fontSize: 12,
        fontWeight: '700',
    },
    breathingControlsRow: {
        marginTop: 18,
    },
    breathingMainBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
    },
    breathingMainBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    activeControlsGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    breathingSecondaryBtn: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    pauseBtn: {
        backgroundColor: COLORS.soft,
    },
    pauseBtnText: {
        color: COLORS.primaryDark,
        fontWeight: '700',
        fontSize: 14,
    },
    endBtn: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    endBtnText: {
        color: COLORS.text,
        fontWeight: '600',
        fontSize: 14,
    },

    /* 6. Self-Care Checklist */
    checklistBadge: {
        backgroundColor: COLORS.mint,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    checklistBadgeText: {
        color: COLORS.mintDark,
        fontSize: 12,
        fontWeight: '800',
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    checklistGrid: {
        gap: 8,
    },
    checklistItem: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 13,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    checklistItemCompleted: {
        backgroundColor: '#F7FCF9',
        borderColor: '#D4EFE2',
    },
    checklistIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    checklistEmoji: {
        fontSize: 16,
    },
    checklistLabel: {
        flex: 1,
        fontSize: 13,
        color: COLORS.heading,
        fontWeight: '600',
    },
    checklistLabelCompleted: {
        color: COLORS.secondaryText,
        textDecorationLine: 'line-through',
    },
    checkboxCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: COLORS.secondaryText,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxCircleCompleted: {
        backgroundColor: COLORS.mintDark,
        borderColor: COLORS.mintDark,
    },
    checkMark: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },

    /* 7. Wellness Tools Grid */
    toolsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    toolCard: {
        width: '48%',
        backgroundColor: COLORS.surface,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    toolIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    toolIconText: {
        fontSize: 19,
    },
    toolTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.heading,
        marginBottom: 4,
    },
    toolDesc: {
        fontSize: 11,
        color: COLORS.secondaryText,
        lineHeight: 16,
        marginBottom: 12,
    },
    toolActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primary,
    },

    /* 8. Wellness Progress */
    viewProgressBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: COLORS.background,
    },
    viewProgressBtnText: {
        fontSize: 11,
        color: COLORS.primaryDark,
        fontWeight: '700',
    },
    emptyProgressBox: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyProgressEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    emptyProgressText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.heading,
        textAlign: 'center',
    },
    emptyProgressSubtext: {
        fontSize: 12,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginTop: 4,
        maxWidth: 260,
    },
    progressMetricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
    },
    metricCard: {
        width: '48%',
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
    },
    metricVal: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.primaryDark,
    },
    metricValTotal: {
        fontSize: 14,
        color: COLORS.secondaryText,
    },
    metricLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.heading,
        marginTop: 4,
    },
    metricSub: {
        fontSize: 10,
        color: COLORS.secondaryText,
        marginTop: 2,
    },

    /* 9. Footer */
    footerContainer: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: COLORS.muted,
        textAlign: 'center',
    },

    /* Modals */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(51, 38, 77, 0.45)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
        maxHeight: '88%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.heading,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: {
        fontSize: 15,
        color: COLORS.secondaryText,
        fontWeight: '700',
    },
    modalNote: {
        fontSize: 13,
        color: COLORS.secondaryText,
        marginBottom: 16,
    },
    modalActionBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 14,
    },
    modalActionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },

    /* Reminders Modal */
    manageReminderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    manageReminderInfo: {
        flex: 1,
    },
    manageReminderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.heading,
    },
    manageReminderTime: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '600',
        marginTop: 2,
    },
    timeEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    timeInput: {
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        fontSize: 12,
        color: COLORS.heading,
        minWidth: 90,
    },
    saveTimeBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    saveTimeBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    /* Journal Modal */
    journalTitleInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.heading,
        fontWeight: '600',
        marginBottom: 12,
    },
    journalTextInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.heading,
        minHeight: 110,
    },

    /* Gratitude Modal */
    gratitudeInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: COLORS.heading,
        marginBottom: 10,
    },

    /* Meditation Modal */
    meditationVisual: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    meditationIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    meditationInstruction: {
        fontSize: 14,
        color: COLORS.text,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    meditationTimerText: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.primaryDark,
        marginTop: 18,
    },

    /* Sleep Modal */
    sleepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    sleepLabel: {
        fontSize: 13,
        color: COLORS.heading,
        marginLeft: 12,
        flex: 1,
    },
});
