import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ScrollView,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Alert,
    Platform,
    Animated,
    Easing,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabase';

const COLORS = {
    background: '#F9F6FF',
    white: '#FFFFFF',
    primary: '#8665BD',
    primaryDark: '#7050A5',
    soft: '#E8DEFA',
    heading: '#33264D',
    text: '#716982',
    muted: '#958AA8',
    border: '#E9E1F3',
    danger: '#D9534F',
    dangerSoft: '#FCE8E8',
};

function showAlert(title, message) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n${message}`);
    } else {
        Alert.alert(title, message);
    }
}

/* ---------- small UI helpers ---------- */

// Fades + slides a block up on mount (native driven, wraps no inputs)
function FadeIn({ delay = 0, from = 16, style, children }) {
    const v = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(v, {
            toValue: 1,
            duration: 520,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [v, delay]);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity: v,
                    transform: [
                        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
                    ],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

// Gentle press-in scale for buttons
function Squish({ onPress, style, children, scaleTo = 0.96 }) {
    const s = useRef(new Animated.Value(1)).current;
    const to = (value) =>
        Animated.spring(s, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    return (
        <Pressable onPress={onPress} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)}>
            <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
        </Pressable>
    );
}

function MenuItem({ icon, title, subtitle, onPress, danger }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
            <View style={[styles.menuIcon, danger && { backgroundColor: COLORS.dangerSoft }]}>
                <Text style={[styles.menuIconText, danger && { color: COLORS.danger }]}>{icon}</Text>
            </View>

            <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, danger && { color: COLORS.danger }]}>{title}</Text>
                {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.arrowWrap}>
                <Text style={styles.menuArrow}>›</Text>
            </View>
        </Pressable>
    );
}


/* ---------- Edit Profile modal ---------- */

function EditProfileModal({ visible, user, onClose, onSaved }) {
    const currentName =
        user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    const [name, setName] = useState(currentName);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const savingRef = useRef(false); // blocks double-taps before state updates
    const closeTimer = useRef(null);

    // Reset the form each time the modal opens
    useEffect(() => {
        if (visible) {
            setName(currentName);
            setError('');
            setSuccess(false);
        }
        return () => clearTimeout(closeTimer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const handleSave = async () => {
        if (savingRef.current) return;

        const newName = name.trim();
        if (!newName) {
            setError('Please enter your name.');
            return;
        }
        if (!user?.id) {
            setError('You need to be signed in to edit your profile.');
            return;
        }
        if (newName === currentName.trim()) {
            onClose();
            return;
        }

        savingRef.current = true;
        setSaving(true);
        setError('');

        try {
            // 1) Supabase Auth user metadata
            const { data: authData, error: authError } = await supabase.auth.updateUser({
                data: { full_name: newName },
            });
            if (authError) throw authError;

            // 2) profiles table (RLS: row must belong to the signed-in user)
            let profileError = null;
            try {
                const { data: rows, error: updError } = await supabase
                    .from('profiles')
                    .update({ full_name: newName })
                    .eq('id', user.id)
                    .select('id');
                if (updError) throw updError;

                if (!rows || rows.length === 0) {
                    // No profile row yet — create it for this user
                    const { error: insError } = await supabase
                        .from('profiles')
                        .upsert({ id: user.id, full_name: newName });
                    if (insError) throw insError;
                }
            } catch (e) {
                profileError = e;
            }

            if (profileError) {
                // Keep both stores consistent: put the old name back in Auth.
                let rolledBack = true;
                try {
                    const { error: rbError } = await supabase.auth.updateUser({
                        data: { full_name: currentName },
                    });
                    if (rbError) rolledBack = false;
                } catch {
                    rolledBack = false;
                }
                setError(
                    `Could not update your profile: ${profileError?.message || 'unknown error'}. ` +
                    (rolledBack
                        ? 'Your name was not changed.'
                        : 'Your sign-in name may have changed but your profile did not. Please try saving again.')
                );
                if (!rolledBack && authData?.user) onSaved(authData.user);
                return;
            }

            // Both succeeded — update app state immediately
            const updatedUser = authData?.user || {
                ...user,
                user_metadata: { ...(user.user_metadata || {}), full_name: newName },
            };
            onSaved(updatedUser);
            setSuccess(true);
            closeTimer.current = setTimeout(onClose, 900);
        } catch (e) {
            setError(e?.message || 'Something went wrong. Please try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => { if (!saving) onClose(); }}
        >
            <KeyboardAvoidingView
                style={styles.modalBackdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!saving) onClose(); }} />

                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Edit Profile</Text>

                    <Text style={styles.fieldLabel}>FULL NAME</Text>
                    <TextInput
                        style={[styles.fieldInput, !!error && styles.fieldInputError]}
                        value={name}
                        onChangeText={(t) => { setName(t); if (error) setError(''); }}
                        placeholder="Your name"
                        placeholderTextColor={COLORS.muted}
                        editable={!saving && !success}
                        autoCapitalize="words"
                        maxLength={60}
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                    />

                    <Text style={styles.fieldLabel}>EMAIL</Text>
                    <View style={[styles.fieldInput, styles.fieldReadOnly]}>
                        <Text style={styles.fieldReadOnlyText} numberOfLines={1}>
                            {user?.email || '—'}
                        </Text>
                    </View>
                    <Text style={styles.fieldHint}>Email can’t be changed here.</Text>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {success ? <Text style={styles.successText}>✓ Profile updated</Text> : null}

                    <View style={styles.modalButtons}>
                        <Pressable
                            style={[styles.modalBtn, styles.cancelBtn]}
                            onPress={onClose}
                            disabled={saving}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.modalBtn, styles.saveBtn, (saving || success) && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving || success}
                        >
                            {saving ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

/* ---------- screen ---------- */

export default function ProfileScreen({
    user,
    onBack,
    onEditProfile,
    onSignOut,
    onUserUpdated,
}) {
    const [editVisible, setEditVisible] = useState(false);
    const isAuthenticated = Boolean(user && (user.id || user.email));

    const displayName = isAuthenticated
        ? user?.user_metadata?.full_name || user?.user_metadata?.name || 'Solace User'
        : 'Guest';

    const email = isAuthenticated ? user?.email : null;

    const initial = displayName.charAt(0).toUpperCase();

    // Soft breathing glow behind the avatar
    const glow = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(glow, {
                    toValue: 1,
                    duration: 2600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(glow, {
                    toValue: 0,
                    duration: 2600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [glow]);

    const handleSignOutPress = async () => {
        if (onSignOut) {
            await onSignOut();
        } else {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
            } catch (error) {
                showAlert('Sign Out Failed', error?.message || 'Unable to sign out. Please try again.');
            }
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            {/* Decorative soft blobs */}
            <View pointerEvents="none" style={styles.blobTop} />
            <View pointerEvents="none" style={styles.blobSide} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header */}
                <FadeIn from={-10}>
                    <View style={styles.header}>
                        <Squish onPress={onBack} style={styles.backButton}>
                            <Text style={styles.backText}>‹</Text>
                        </Squish>

                        <Text style={styles.headerTitle}>My Profile</Text>

                        <View style={{ width: 42 }} />
                    </View>
                </FadeIn>

                {/* Profile Card */}
                <FadeIn delay={80}>
                    <View style={styles.profileCard}>
                        <View style={styles.avatarWrap}>
                            <Animated.View
                                style={[
                                    styles.avatarHalo,
                                    {
                                        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
                                        transform: [
                                            { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] }) },
                                        ],
                                    },
                                ]}
                            />
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{initial}</Text>
                            </View>
                        </View>

                        <Text style={styles.name}>{displayName}</Text>
                        {isAuthenticated && email ? (
                            <Text style={styles.email}>{email}</Text>
                        ) : null}

                        <View style={[styles.memberBadge, !isAuthenticated && styles.guestBadge]}>
                            <View style={[styles.badgeDot, !isAuthenticated && styles.guestDot]} />
                            <Text style={[styles.memberBadgeText, !isAuthenticated && styles.guestBadgeText]}>
                                {isAuthenticated ? 'Google Account Connected' : 'Guest Mode — Not Signed In'}
                            </Text>
                        </View>

                        <Squish onPress={() => setEditVisible(true)} style={styles.editButton} scaleTo={0.95}>
                            <Text style={styles.editButtonText}>Edit Profile</Text>
                        </Squish>
                    </View>
                </FadeIn>

                {/* Wellness Section */}
                <FadeIn delay={170}>
                    <Text style={styles.sectionTitle}>YOUR WELLNESS</Text>

                    <View style={styles.menuCard}>
                        <MenuItem
                            icon="♡"
                            title="My Wellness Goals"
                            subtitle="Manage your personal goals"
                            onPress={() => { }}
                        />

                        <View style={styles.separator} />

                        <MenuItem
                            icon="☾"
                            title="Mood History"
                            subtitle="View your emotional journey"
                            onPress={() => { }}
                        />

                        <View style={styles.separator} />

                        <MenuItem
                            icon="◷"
                            title="Progress & Insights"
                            subtitle="Track your wellness progress"
                            onPress={() => { }}
                        />
                    </View>
                </FadeIn>

                {/* Settings Section */}
                <FadeIn delay={260}>
                    <Text style={styles.sectionTitle}>PREFERENCES</Text>

                    <View style={styles.menuCard}>
                        <MenuItem
                            icon="♧"
                            title="Notifications"
                            subtitle="Manage reminders and updates"
                            onPress={() => { }}
                        />

                        <View style={styles.separator} />

                        <MenuItem
                            icon="⚙"
                            title="App Settings"
                            subtitle="Personalize your experience"
                            onPress={() => { }}
                        />

                        <View style={styles.separator} />

                        <MenuItem
                            icon="?"
                            title="Help & Support"
                            subtitle="We're here to help"
                            onPress={() => { }}
                        />
                    </View>
                </FadeIn>

                {/* Account */}
                <FadeIn delay={350}>
                    <Text style={styles.sectionTitle}>ACCOUNT</Text>

                    <View style={styles.menuCard}>
                        <MenuItem
                            icon="↪"
                            title="Sign Out"
                            subtitle="Sign out of your account"
                            danger
                            onPress={handleSignOutPress}
                        />
                    </View>
                </FadeIn>

                <FadeIn delay={440} from={8}>
                    <Text style={styles.footer}>Made with ♡ by Solace AI</Text>
                    <Text style={styles.version}>Version 1.0.0</Text>
                </FadeIn>
            </ScrollView>

            <EditProfileModal
                visible={editVisible}
                user={user}
                onClose={() => setEditVisible(false)}
                onSaved={(u) => onUserUpdated && onUserUpdated(u)}
            />
        </SafeAreaView>
    );
}

const softShadow = Platform.select({
    ios: {
        shadowColor: '#8665BD',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 3 },
    default: {},
});

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    },
    blobTop: {
        position: 'absolute',
        top: -90,
        right: -70,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: COLORS.soft,
        opacity: 0.55,
    },
    blobSide: {
        position: 'absolute',
        top: 340,
        left: -110,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: COLORS.soft,
        opacity: 0.3,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...softShadow,
    },
    backText: {
        fontSize: 32,
        lineHeight: 36,
        marginTop: -2,
        color: COLORS.primary,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '700',
        color: COLORS.heading,
        letterSpacing: 0.2,
    },
    profileCard: {
        backgroundColor: COLORS.white,
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...softShadow,
    },
    avatarWrap: {
        width: 116,
        height: 116,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarHalo: {
        position: 'absolute',
        width: 116,
        height: 116,
        borderRadius: 40,
        backgroundColor: COLORS.soft,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 30,
        backgroundColor: COLORS.soft,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.white,
        ...softShadow,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '700',
        color: COLORS.primary,
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.heading,
    },
    email: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 6,
    },
    memberBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 14,
        borderWidth: 1,
        borderColor: COLORS.soft,
    },
    badgeDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#6FCF97',
        marginRight: 8,
    },
    guestDot: {
        backgroundColor: COLORS.muted,
    },
    memberBadgeText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    guestBadge: {
        backgroundColor: '#F3EEFB',
    },
    guestBadgeText: {
        color: COLORS.muted,
    },
    editButton: {
        marginTop: 20,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 34,
        paddingVertical: 12,
        borderRadius: 14,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 4 },
            default: {},
        }),
    },
    editButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: COLORS.muted,
        marginTop: 28,
        marginBottom: 12,
        marginLeft: 6,
    },
    menuCard: {
        backgroundColor: COLORS.white,
        borderRadius: 22,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        ...softShadow,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 9,
        borderRadius: 16,
        marginVertical: 2,
    },
    menuItemPressed: {
        backgroundColor: COLORS.background,
    },
    menuIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuIconText: {
        fontSize: 21,
        color: COLORS.primary,
    },
    menuContent: {
        flex: 1,
        marginLeft: 13,
    },
    menuTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.heading,
    },
    menuSubtitle: {
        fontSize: 11,
        color: COLORS.muted,
        marginTop: 4,
    },
    arrowWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    menuArrow: {
        fontSize: 20,
        lineHeight: 23,
        color: COLORS.muted,
    },
    separator: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 64,
        marginRight: 9,
    },
    footer: {
        textAlign: 'center',
        color: COLORS.text,
        fontSize: 12,
        marginTop: 32,
    },
    version: {
        textAlign: 'center',
        color: COLORS.muted,
        fontSize: 10,
        marginTop: 7,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(51, 38, 77, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 22,
    },
    modalCard: {
        backgroundColor: COLORS.white,
        borderRadius: 26,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.heading,
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: COLORS.muted,
        marginBottom: 8,
        marginLeft: 4,
    },
    fieldInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 50,
        fontSize: 15,
        color: COLORS.heading,
        marginBottom: 16,
    },
    fieldInputError: {
        borderColor: COLORS.danger,
    },
    fieldReadOnly: {
        justifyContent: 'center',
        marginBottom: 6,
        opacity: 0.7,
    },
    fieldReadOnlyText: {
        fontSize: 15,
        color: COLORS.text,
    },
    fieldHint: {
        fontSize: 11,
        color: COLORS.muted,
        marginLeft: 4,
        marginBottom: 6,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 8,
    },
    successText: {
        color: '#3E9B6B',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 8,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 20,
    },
    modalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 10,
    },
    cancelBtnText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: COLORS.primary,
    },
    saveBtnText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '700',
    },
});