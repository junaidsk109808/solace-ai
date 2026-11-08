import { supabase } from '../supabase';

// Tables: conversations (id, user_id, title, created_at)
//         messages (id, conversation_id, sender 'user' | 'ai', content, created_at)
// RLS ownership is enforced by Supabase; we only ever use the signed-in client.

const HISTORY_LIMIT = 100;

// The DB only accepts 'user' or 'ai'. Anything else (e.g. 'assistant') -> 'ai'.
const toDbSender = (role) => {
    if (role === 'user') return 'user';
    if (role === 'ai' || role === 'assistant') return 'ai';
    return null;
};

/** Creates a conversation. Returns its id, or null on failure. */
export async function createConversation(userId, title = 'New chat') {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('conversations')
            .insert({ user_id: userId, title })
            .select('id')
            .single();
        if (error) throw error;
        return data?.id ?? null;
    } catch (error) {
        console.warn('createConversation failed:', error?.message || error);
        return null;
    }
}

/** Returns the user's most recent conversation ({ id, ... }) or null. */
export async function loadLatestConversation(userId) {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('conversations')
            .select('id, title, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    } catch (error) {
        console.warn('loadLatestConversation failed:', error?.message || error);
        return null;
    }
}

/** Returns saved messages (oldest first) as ChatScreen items: { id, text, sender }. */
export async function loadMessages(conversationId) {
    if (!conversationId) return [];
    try {
        // Newest N, then reversed, so long chats still show the latest messages.
        const { data, error } = await supabase
            .from('messages')
            .select('id, sender, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);
        if (error) throw error;

        return (data || [])
            .reverse()
            .filter((row) => typeof row.content === 'string' && row.content.trim())
            .map((row) => ({
                id: `db-${row.id}`,
                text: row.content,
                sender: row.sender === 'user' ? 'user' : 'ai',
            }));
    } catch (error) {
        console.warn('loadMessages failed:', error?.message || error);
        return [];
    }
}

/**
 * Saves one message. `role` is 'user' or 'ai' ('assistant' is converted to 'ai').
 * `userId` is accepted for call-site compatibility only: the messages table has
 * no user_id column, so ownership is enforced through the conversation by RLS.
 * Returns true on success, false otherwise. Never throws.
 */
export async function saveMessage(conversationId, userId, role, content) {
    const sender = toDbSender(role);
    const text = typeof content === 'string' ? content.trim() : '';
    if (!conversationId || !sender || !text) return false;
    try {
        const { error } = await supabase
            .from('messages')
            .insert({ conversation_id: conversationId, sender, content: text });
        if (error) throw error;
        return true;
    } catch (error) {
        console.warn('saveMessage failed:', error?.message || error);
        return false;
    }
}