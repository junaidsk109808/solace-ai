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

/**
 * Deletes ALL messages of one conversation (the conversation row itself is kept).
 * Returns { ok: true } or { ok: false, error: '<message>' }. Never throws.
 * RLS can silently block a delete (0 rows, no error), so we verify that nothing
 * is left afterwards instead of trusting the absence of an error.
 */
export async function clearMessages(conversationId) {
    if (!conversationId) return { ok: false, error: 'No open conversation to clear.' };
    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId);
        if (error) throw error;

        const { count, error: checkError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conversationId);
        if (checkError) throw checkError;

        if (count && count > 0) {
            return {
                ok: false,
                error: 'The database did not allow these messages to be deleted (check the delete policy on messages).',
            };
        }
        return { ok: true };
    } catch (error) {
        console.warn('clearMessages failed:', error?.message || error);
        return { ok: false, error: error?.message || 'Unknown error.' };
    }
}