import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    Animated,
    Easing,
} from 'react-native';

// Backend endpoint for Solace AI Gemini chat
const BACKEND_API_URL = 'https://solace-ai-backend.onrender.com/chat';

// Supabase persistence — saves actual messages only, never fake responses
import {
    createConversation,
    loadLatestConversation,
    loadMessages,
    saveMessage,
} from '../services/chatPersistence';

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
    bubbleUser: '#8665BD',
    bubbleAi: '#FFFFFF',
    errorBubble: '#FFF5F7',
    errorBorder: '#F2D3DC',
    errorText: '#824859',
    errorIconBg: '#F8DCE3',
    errorIcon: '#D9566B',
};

const SUGGESTED_PROMPTS = [
    'I feel a bit overwhelmed 🌿',
    'Help me calm my mind 🫧',
    'I had a tiring day 😴',
    'Can we do a breathing pause? 🧘',
];

// ---------------------------------------------------------------------------
// Inline Markdown renderer — zero external dependencies.
// Handles: **bold**, *italic*, `code`, headings (#/##/###),
//          bullet lists (*/–/-), numbered lists, paragraphs, blank lines.
// Applied only to AI messages; user messages remain plain <Text>.
// ---------------------------------------------------------------------------

/**
 * Parse a single line of inline markdown into an array of tokens.
 * Each token is { text, bold, italic, code }.
 */
function parseInline(line) {
    const tokens = [];
    // Regex matches **bold**, *italic*, `code` in one pass (order matters)
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
        if (m.index > last) tokens.push({ text: line.slice(last, m.index), bold: false, italic: false, code: false });
        if (m[0].startsWith('**')) tokens.push({ text: m[2], bold: true, italic: false, code: false });
        else if (m[0].startsWith('`')) tokens.push({ text: m[4], bold: false, italic: false, code: true });
        else tokens.push({ text: m[3], bold: false, italic: true, code: false });
        last = m.index + m[0].length;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), bold: false, italic: false, code: false });
    return tokens;
}

/** Render one line's inline tokens as a <Text> fragment. */
function InlineLine({ tokens, baseStyle }) {
    return (
        <Text style={baseStyle}>
            {tokens.map((tok, i) => {
                if (tok.code) return <Text key={i} style={mdStyles.inlineCode}>{tok.text}</Text>;
                if (tok.bold && tok.italic) return <Text key={i} style={[mdStyles.bold, mdStyles.italic]}>{tok.text}</Text>;
                if (tok.bold) return <Text key={i} style={mdStyles.bold}>{tok.text}</Text>;
                if (tok.italic) return <Text key={i} style={mdStyles.italic}>{tok.text}</Text>;
                return <Text key={i}>{tok.text}</Text>;
            })}
        </Text>
    );
}

/**
 * Full block-level Markdown renderer for AI responses.
 * Splits text into logical blocks, then renders each block type.
 */
function MarkdownText({ text }) {
    const rawLines = text.split('\n');

    // Build block list
    const blocks = [];
    let i = 0;
    while (i < rawLines.length) {
        const line = rawLines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            // blank line — paragraph gap only if not already one
            if (blocks.length && blocks[blocks.length - 1].type !== 'gap') {
                blocks.push({ type: 'gap' });
            }
            i++;
            continue;
        }

        // Heading: #, ##, ###
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
        if (headingMatch) {
            blocks.push({ type: 'heading', level: headingMatch[1].length, tokens: parseInline(headingMatch[2]) });
            i++;
            continue;
        }

        // Bullet list item: *, –, -
        const bulletMatch = trimmed.match(/^([*\-–])\s+(.*)/);
        if (bulletMatch) {
            blocks.push({ type: 'bullet', tokens: parseInline(bulletMatch[2]) });
            i++;
            continue;
        }

        // Numbered list: 1. 2. etc.
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
            blocks.push({ type: 'numbered', num: numberedMatch[1], tokens: parseInline(numberedMatch[2]) });
            i++;
            continue;
        }

        // Plain paragraph line
        blocks.push({ type: 'para', tokens: parseInline(trimmed) });
        i++;
    }

    // Remove leading/trailing gaps
    while (blocks.length && blocks[0].type === 'gap') blocks.shift();
    while (blocks.length && blocks[blocks.length - 1].type === 'gap') blocks.pop();

    return (
        <View>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'gap':
                        return <View key={idx} style={mdStyles.blockGap} />;

                    case 'heading': {
                        const hs = [mdStyles.h1, mdStyles.h2, mdStyles.h3][block.level - 1] || mdStyles.h3;
                        return (
                            <View key={idx} style={mdStyles.headingWrap}>
                                <InlineLine tokens={block.tokens} baseStyle={hs} />
                            </View>
                        );
                    }

                    case 'bullet':
                        return (
                            <View key={idx} style={mdStyles.listRow}>
                                <Text style={mdStyles.bullet}>•</Text>
                                <View style={mdStyles.listContent}>
                                    <InlineLine tokens={block.tokens} baseStyle={mdStyles.listText} />
                                </View>
                            </View>
                        );

                    case 'numbered':
                        return (
                            <View key={idx} style={mdStyles.listRow}>
                                <Text style={mdStyles.bullet}>{block.num}.</Text>
                                <View style={mdStyles.listContent}>
                                    <InlineLine tokens={block.tokens} baseStyle={mdStyles.listText} />
                                </View>
                            </View>
                        );

                    case 'para':
                    default:
                        return (
                            <View key={idx} style={mdStyles.paraWrap}>
                                <InlineLine tokens={block.tokens} baseStyle={mdStyles.para} />
                            </View>
                        );
                }
            })}
        </View>
    );
}

/** Stylesheet for Markdown elements, using Lavender Dream palette. */
const mdStyles = StyleSheet.create({
    para: {
        fontSize: 14,
        lineHeight: 22,
        color: '#33264D',
    },
    paraWrap: {
        marginBottom: 2,
    },
    blockGap: {
        height: 8,
    },
    headingWrap: {
        marginTop: 4,
        marginBottom: 2,
    },
    h1: {
        fontSize: 17,
        fontWeight: '800',
        color: '#33264D',
        lineHeight: 26,
    },
    h2: {
        fontSize: 15,
        fontWeight: '700',
        color: '#33264D',
        lineHeight: 24,
    },
    h3: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8665BD',
        lineHeight: 22,
    },
    bold: {
        fontWeight: '700',
        color: '#33264D',
    },
    italic: {
        fontStyle: 'italic',
    },
    inlineCode: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
        backgroundColor: '#E8DEFA',
        color: '#7050A5',
        borderRadius: 4,
        paddingHorizontal: 4,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 3,
    },
    bullet: {
        fontSize: 14,
        lineHeight: 22,
        color: '#8665BD',
        fontWeight: '700',
        marginRight: 7,
        minWidth: 16,
    },
    listContent: {
        flex: 1,
    },
    listText: {
        fontSize: 14,
        lineHeight: 22,
        color: '#33264D',
    },
});

// Animated 3-dot typing indicator
function TypingIndicator() {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animateDot = (dot, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 350,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0.3,
                        duration: 350,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );

        const a1 = animateDot(dot1, 0);
        const a2 = animateDot(dot2, 180);
        const a3 = animateDot(dot3, 360);

        a1.start();
        a2.start();
        a3.start();

        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, [dot1, dot2, dot3]);

    return (
        <View style={[styles.messageRow, styles.aiRow]}>
            <View style={styles.aiAvatar}>
                <Text style={styles.avatarSymbol}>✦</Text>
            </View>
            <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
                <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
            </View>
        </View>
    );
}

const WELCOME_ID = '1';

export default function ChatScreen({ onBack, user }) {
    const firstName =
        user?.user_metadata?.full_name?.split(' ')[0] ||
        user?.user_metadata?.name?.split(' ')[0] ||
        '';

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [inputHeight, setInputHeight] = useState(52);
    // Supabase conversation UUID for this chat session. Null until the row is created.
    const [conversationId, setConversationId] = useState(null);

    const MIN_INPUT_HEIGHT = 52;
    const MAX_INPUT_HEIGHT = 120;

    const handleContentSizeChange = (e) => {
        const newHeight = Math.min(
            Math.max(e.nativeEvent.contentSize.height + 20, MIN_INPUT_HEIGHT),
            MAX_INPUT_HEIGHT
        );
        setInputHeight(newHeight);
    };
    const [messages, setMessages] = useState([
        {
            id: WELCOME_ID,
            text: `Hey${firstName ? ` ${firstName}` : ''}! I'm Solace, your personal wellness companion. 💜\n\nI'm here to listen without judgment, support you, and help you find peace.\n\nHow are you feeling right now?`,
            sender: 'ai',
        },
    ]);

    const flatListRef = useRef(null);
    // Always-current conversation id + the in-flight init promise, so a message
    // sent before init finishes is saved to the right conversation (no duplicates).
    const conversationIdRef = useRef(null);
    const initPromiseRef = useRef(null);

    // Create a Supabase conversation row when the chat screen mounts.
    // Only runs when the user is authenticated (user prop is not null).
    useEffect(() => {
        if (!user?.id) return;

        let cancelled = false;

        const initializeChat = async () => {
            try {
                // Reuse the latest conversation, or create one only if none exists
                const latest = await loadLatestConversation(user.id);
                if (cancelled) return null;

                let activeConversationId = latest?.id || null;
                if (!activeConversationId) {
                    activeConversationId = await createConversation(user.id);
                    if (cancelled) return null;
                }
                if (!activeConversationId) return null;

                conversationIdRef.current = activeConversationId;
                setConversationId(activeConversationId);

                const history = await loadMessages(activeConversationId);
                if (cancelled) return activeConversationId;

                // Show saved history; keep the welcome message when there is none.
                // Anything sent while loading stays after the history.
                if (Array.isArray(history) && history.length > 0) {
                    setMessages((prev) => [
                        ...history,
                        ...prev.filter((m) => m.id !== WELCOME_ID),
                    ]);
                }
                return activeConversationId;
            } catch (error) {
                console.warn('Chat init failed:', error?.message || error);
                return null;
            }
        };

        initPromiseRef.current = initializeChat();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    // Save a message without ever throwing into the chat UI.
    // Waits for conversation init if it has not finished yet.
    const persistMessage = async (role, content) => {
        try {
            if (!user?.id || !content) return;
            const id = conversationIdRef.current || (await initPromiseRef.current);
            if (!id) return;
            await saveMessage(id, user.id, role, content);
        } catch (error) {
            console.warn('Could not save message:', error?.message || error);
        }
    };

    const handleSendMessage = async (textToSend, isRetry = false) => {
        const trimmed = (textToSend || input).trim();
        // Prevent sending empty message or sending while request is already pending
        if (!trimmed || isTyping) return;

        const userMsg = {
            id: Date.now().toString(),
            text: trimmed,
            sender: 'user',
        };

        // Display user message immediately and clear input
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setInputHeight(52); // reset input height after send
        setIsTyping(true);

        // Persist user message to Supabase (fire-and-forget; never blocks UI)
        // Retries were already saved the first time, so skip to avoid duplicates.
        if (!isRetry) {
            persistMessage('user', trimmed);
        }

        try {
            // Setup timeout with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

            const response = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ message: trimmed }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorDetail = '';
                try {
                    const errData = await response.json();
                    errorDetail = errData?.detail || '';
                } catch {
                    // Non-JSON response
                }
                throw new Error(
                    errorDetail || `Backend returned error (HTTP ${response.status})`
                );
            }

            const data = await response.json();

            if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
                throw new Error('Gemini returned an empty response.');
            }

            const aiMsg = {
                id: (Date.now() + 1).toString(),
                text: data.reply.trim(),
                sender: 'ai',
            };

            setMessages((prev) => [...prev, aiMsg]);

            // Persist the real Gemini reply to Supabase.
            // Only called when data.reply is a non-empty actual response.
            persistMessage('ai', data.reply.trim());
        } catch (error) {
            let errorText = 'I am having trouble connecting right now. Please verify that the backend is running at http://192.168.1.106:8000 and reachable from your device.';

            if (error.name === 'AbortError') {
                errorText = 'Connection timed out while waiting for Gemini to respond. Please try again.';
            } else if (error.message && !error.message.includes('HTTP')) {
                errorText = `Unable to reach Solace backend: ${error.message}`;
            } else if (error.message) {
                errorText = `Error from Solace backend: ${error.message}`;
            }

            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: errorText,
                sender: 'ai',
                isError: true,
                retryMessage: trimmed,
            };

            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return () => clearTimeout(timeout);
    }, [messages, isTyping]);

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';
        const isError = Boolean(item.isError);

        return (
            <View
                style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.aiRow,
                ]}
            >
                {!isUser && (
                    <View style={[styles.aiAvatar, isError && styles.aiAvatarError]}>
                        <Text style={[styles.avatarSymbol, isError && styles.avatarSymbolError]}>
                            {isError ? '!' : '✦'}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.aiBubble,
                        isError && styles.errorBubble,
                    ]}
                >
                    {/* User messages → plain Text. AI messages → Markdown renderer. */}
                    {isUser || isError ? (
                        <Text
                            style={[
                                styles.messageText,
                                isUser ? styles.userMessageText : styles.aiMessageText,
                                isError && styles.errorMessageText,
                            ]}
                        >
                            {item.text}
                        </Text>
                    ) : (
                        <MarkdownText text={item.text} />
                    )}

                    {isError && item.retryMessage && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => handleSendMessage(item.retryMessage, true)}
                            disabled={isTyping}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.retryButtonText}>↻ Tap to retry</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>‹</Text>
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <View style={styles.headerAvatar}>
                            <Text style={styles.avatarSymbol}>✦</Text>
                        </View>

                        <View>
                            <Text style={styles.headerTitle}>Solace AI</Text>
                            <View style={styles.onlineStatusRow}>
                                <View style={styles.onlineDot} />
                                <Text style={styles.onlineText}>Powered by Gemini</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.headerSpace} />
                </View>

                {/* Chat introduction */}
                <View style={styles.dateContainer}>
                    <Text style={styles.dateText}>YOUR SAFE SPACE 💜</Text>
                </View>

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesContainer}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={isTyping ? <TypingIndicator /> : null}
                />

                {/* Suggested Prompts */}
                {messages.length <= 3 && !isTyping && (
                    <View style={styles.promptSuggestionsWrap}>
                        <FlatList
                            data={SUGGESTED_PROMPTS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item}
                            contentContainerStyle={styles.promptSuggestionsContainer}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.promptPill}
                                    onPress={() => handleSendMessage(item)}
                                    disabled={isTyping}
                                >
                                    <Text style={styles.promptPillText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputContainer}>
                    <View style={styles.inputBox}>
                        <TextInput
                            style={[styles.textInput, { height: inputHeight }]}
                            placeholder={isTyping ? "Solace is reflecting..." : "Share what's on your mind..."}
                            placeholderTextColor={COLORS.muted}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={2000}
                            editable={!isTyping}
                            onContentSizeChange={handleContentSizeChange}
                            scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                        />

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!input.trim() || isTyping) && styles.sendButtonDisabled,
                            ]}
                            onPress={() => handleSendMessage()}
                            disabled={!input.trim() || isTyping}
                        >
                            <Text style={styles.sendIcon}>↑</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.footerText}>
                        Solace is here to listen. You are not alone.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 34,
        color: COLORS.primary,
        lineHeight: 38,
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        gap: 10,
    },
    headerAvatar: {
        width: 42,
        height: 42,
        borderRadius: 15,
        backgroundColor: COLORS.soft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarSymbol: {
        fontSize: 21,
        color: COLORS.primary,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.heading,
    },
    onlineStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#4A9878',
    },
    onlineText: {
        fontSize: 11,
        color: COLORS.muted,
    },
    headerSpace: {
        width: 42,
    },
    dateContainer: {
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 8,
    },
    dateText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: COLORS.muted,
    },
    messagesContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    aiRow: {
        justifyContent: 'flex-start',
    },
    userRow: {
        justifyContent: 'flex-end',
    },
    aiAvatar: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: COLORS.soft,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    aiAvatarError: {
        backgroundColor: COLORS.errorIconBg,
    },
    avatarSymbol: {
        fontSize: 18,
        color: COLORS.primary,
    },
    avatarSymbolError: {
        color: COLORS.errorIcon,
        fontWeight: '700',
        fontSize: 16,
    },
    messageBubble: {
        maxWidth: '82%',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 20,
    },
    aiBubble: {
        backgroundColor: COLORS.bubbleAi,
        borderBottomLeftRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
    },
    userBubble: {
        backgroundColor: COLORS.bubbleUser,
        borderBottomRightRadius: 6,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 2,
    },
    errorBubble: {
        backgroundColor: COLORS.errorBubble,
        borderColor: COLORS.errorBorder,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 22,
    },
    aiMessageText: {
        color: COLORS.heading,
    },
    userMessageText: {
        color: COLORS.white,
    },
    errorMessageText: {
        color: COLORS.errorText,
    },
    retryButton: {
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: COLORS.soft,
        borderRadius: 12,
    },
    retryButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 6,
        minWidth: 64,
        justifyContent: 'center',
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
    },
    promptSuggestionsWrap: {
        paddingVertical: 8,
    },
    promptSuggestionsContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    promptPill: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    promptPillText: {
        color: COLORS.primaryDark,
        fontSize: 12,
        fontWeight: '600',
    },
    inputContainer: {
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 10 : 14,
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.background,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingLeft: 15,
        paddingRight: 7,
        paddingVertical: 7,
        minHeight: 52,
    },
    textInput: {
        flex: 1,
        color: COLORS.heading,
        fontSize: 14,
        paddingVertical: 4,
        paddingTop: 0,
        textAlignVertical: 'top',
    },
    sendButton: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginBottom: 0,
    },
    sendButtonDisabled: {
        opacity: 0.4,
    },
    sendIcon: {
        color: COLORS.white,
        fontSize: 22,
        fontWeight: '700',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 10,
        color: COLORS.muted,
        marginTop: 8,
    },
});