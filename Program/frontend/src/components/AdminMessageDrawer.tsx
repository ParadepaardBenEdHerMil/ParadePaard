import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSharedInboxPanel, useConversationAvatarUrls } from "../pages/AdminMessages";
import { UserServices, type MessageConversationDTO, type MessageRealtimeEventDTO } from "../services/user-service/UserServices";
import "../stylesheets/Messages.css";

type AdminMessageDrawerProps = {
    open: boolean;
};

export default function AdminMessageDrawer({ open }: AdminMessageDrawerProps) {
    const [conversations, setConversations] = useState<MessageConversationDTO[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<MessageConversationDTO | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const avatarUrls = useConversationAvatarUrls(conversations);

    const sseBaseUrl = useMemo(() => {
        const base = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004").replace(/\/$/, "");
        return base;
    }, []);

    const refreshSelectedConversation = useCallback(async () => {
        const conversationId = selectedConversation?.conversationId;
        if (!conversationId) return;
        try {
            setDetailLoading(true);
            setDetailError(null);
            setSelectedConversation(await UserServices.getAdminMessageConversation(conversationId));
        } catch (err: unknown) {
            setDetailError(err instanceof Error ? err.message : "Could not load this conversation");
        } finally {
            setDetailLoading(false);
        }
    }, [selectedConversation?.conversationId]);

    const loadConversations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setConversations(await UserServices.getAdminMessageConversations());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not load the shared inbox");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadConversation = async (conversationId: string) => {
        try {
            const conversationPreview = conversations.find((conversation) => conversation.conversationId === conversationId);
            if (conversationPreview) {
                setSelectedConversation(conversationPreview);
            }
            setDetailLoading(true);
            setDetailError(null);
            setSelectedConversation(await UserServices.getAdminMessageConversation(conversationId));
        } catch (err: unknown) {
            setDetailError(err instanceof Error ? err.message : "Could not load this conversation");
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        void loadConversations();
    }, [loadConversations, open]);

    useEffect(() => {
        if (!open) return;

        if (typeof EventSource === "undefined") {
            const interval = window.setInterval(() => {
                void loadConversations();
                void refreshSelectedConversation();
            }, 4000);
            return () => window.clearInterval(interval);
        }

        const source = new EventSource(`${sseBaseUrl}/api/messages/admin/conversations/stream`, { withCredentials: true });

        source.onmessage = (evt: MessageEvent<string>) => {
            let data: MessageRealtimeEventDTO | null = null;
            try {
                data = JSON.parse(evt.data) as MessageRealtimeEventDTO;
            } catch {
                return;
            }

            const conversationId = data?.conversationId ?? null;
            const incoming = data?.message ?? null;
            if (!conversationId || !incoming?.messageId) return;

            setConversations((prev) => {
                const next = prev.slice();
                const idx = next.findIndex((c) => c.conversationId === conversationId);
                if (idx === -1) {
                    next.push({
                        conversationId,
                        userId: null,
                        userDisplayName: data?.userDisplayName ?? null,
                        userEmail: data?.userEmail ?? null,
                        lastMessagePreview: data?.lastMessagePreview ?? incoming.body ?? null,
                        lastMessageAt: data?.lastMessageAt ?? null,
                        unreadByAdminCount: data?.unreadByAdminCount ?? 0,
                        unreadByUserCount: data?.unreadByUserCount ?? 0,
                        messages: [],
                    });
                } else {
                    const existing = next[idx];
                    next[idx] = {
                        ...existing,
                        lastMessageAt: data?.lastMessageAt ?? existing.lastMessageAt,
                        lastMessagePreview: data?.lastMessagePreview ?? existing.lastMessagePreview,
                        unreadByAdminCount: data?.unreadByAdminCount ?? existing.unreadByAdminCount,
                        unreadByUserCount: data?.unreadByUserCount ?? existing.unreadByUserCount,
                    };
                }

                next.sort((a, b) => {
                    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
                    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
                    return tb - ta;
                });
                return next;
            });

            setSelectedConversation((prev) => {
                if (!prev) return prev;
                if ((prev.conversationId ?? null) !== conversationId) return prev;

                const messages = prev.messages ?? [];
                if (messages.some((m) => m.messageId === incoming.messageId)) return prev;

                const nextMessages = [...messages, incoming].slice().sort((a, b) => {
                    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                    if (ta !== tb) return ta - tb;
                    return String(a.messageId ?? "").localeCompare(String(b.messageId ?? ""));
                });

                return {
                    ...prev,
                    lastMessageAt: data?.lastMessageAt ?? prev.lastMessageAt,
                    lastMessagePreview: data?.lastMessagePreview ?? prev.lastMessagePreview,
                    unreadByAdminCount: data?.unreadByAdminCount ?? prev.unreadByAdminCount,
                    unreadByUserCount: data?.unreadByUserCount ?? prev.unreadByUserCount,
                    messages: nextMessages,
                };
            });
        };

        return () => source.close();
    }, [loadConversations, open, refreshSelectedConversation, sseBaseUrl]);

    const sendReply = async () => {
        const conversationId = selectedConversation?.conversationId;
        const body = draft.trim();
        if (!conversationId || !body) return;
        try {
            setSending(true);
            setSendError(null);
            setSelectedConversation(await UserServices.sendAdminMessage(conversationId, { body }));
            setDraft("");
            setConversations(await UserServices.getAdminMessageConversations());
        } catch (err: unknown) {
            setSendError(err instanceof Error ? err.message : "Could not send this reply");
        } finally {
            setSending(false);
        }
    };

    if (!open) return null;

    return (
        <aside className="adminMessageDrawer" aria-label="Shared admin inbox">
            <AdminSharedInboxPanel
                conversations={conversations}
                selectedConversation={selectedConversation}
                avatarUrls={avatarUrls}
                loading={loading}
                detailLoading={detailLoading}
                error={error}
                detailError={detailError}
                draft={draft}
                sending={sending}
                sendError={sendError}
                onSelectConversation={(conversationId) => void loadConversation(conversationId)}
                onDraftChange={setDraft}
                onSend={() => void sendReply()}
                onBackToInbox={() => {
                    setSelectedConversation(null);
                    setDraft("");
                    setDetailError(null);
                }}
            />
        </aside>
    );
}
