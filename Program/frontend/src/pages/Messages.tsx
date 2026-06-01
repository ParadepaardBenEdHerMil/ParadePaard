import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import { UserServices, type MessageConversationDTO, type MessageEntryDTO, type MessageRealtimeEventDTO } from "../services/user-service/UserServices";
import "../stylesheets/Messages.css";

type UserMessagesViewProps = {
    conversation: MessageConversationDTO | null;
    loading: boolean;
    error: string | null;
    draft: string;
    sending: boolean;
    sendError: string | null;
    onDraftChange: (value: string) => void;
    onSend: () => void;
};

function formatMessageTime(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function MessageBubble({ message }: { message: MessageEntryDTO }) {
    const senderType = (message.senderType ?? "").toUpperCase();
    const isAdmin = senderType === "ADMIN";
    const label = isAdmin ? "Company" : "You";
    return (
        <article className={`messageBubble ${isAdmin ? "messageBubble--admin" : "messageBubble--user"}`}>
            <div className="messageBubbleHeader">
                <span>{label}</span>
                <span>{formatMessageTime(message.createdAt)}</span>
            </div>
            <p className="messageBubbleBody">{message.body}</p>
        </article>
    );
}

export function UserMessagesView({
    conversation,
    loading,
    error,
    draft,
    sending,
    sendError,
    onDraftChange,
    onSend,
}: UserMessagesViewProps) {
    const messages = conversation?.messages ?? [];
    const messageListRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = messageListRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distanceFromBottom < 80;
        if (!nearBottom) return;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, [messages.length]);

    return (
        <>
            <Navbar />
            <div className="messagesPage">
                <div className="pageShell">
                    {/* While the user is on /messages, the backend resets their
                        unread count to 0 (GET /messages/me). Force the sidebar
                        badge to 0 here so it disappears as soon as the page
                        opens, instead of waiting for a SSE push or the next
                        navigation to re-fetch. */}
                    <PrimaryNav messageUnreadCount={0} />
                    <main className="pageShellContent messagesThreadOnly">
                        <header className="pageHeader">
                            <h1 className="pageTitle">Messages</h1>
                        </header>
                        <section className="messagePanel">
                            <div className="messagePanelHeader">
                                <div>
                                    <h2 className="messagePanelTitle">Company inbox</h2>
                                    <p className="messagePanelMeta">One ongoing conversation with the company.</p>
                                </div>
                            </div>

                            {loading ? <p className="messageEmpty">Loading messages...</p> : null}
                            {error ? <p className="messageError">{error}</p> : null}
                            {!loading && !error ? (
                                <div className="messageList" ref={messageListRef}>
                                    {messages.length === 0 ? (
                                        <div>
                                            <p className="messageEmpty">No messages yet</p>
                                            <p className="messagePanelMeta">Send your first message to the company.</p>
                                        </div>
                                    ) : (
                                        messages.map((message) => (
                                            <MessageBubble key={message.messageId ?? `${message.createdAt}-${message.body}`} message={message} />
                                        ))
                                    )}
                                </div>
                            ) : null}

                            <div className="messageComposer">
                                <label className="messagePanelTitle" htmlFor="message-body">Send message</label>
                                <textarea
                                    id="message-body"
                                    value={draft}
                                    onChange={(event) => onDraftChange(event.target.value)}
                                    placeholder="Write your message to the company."
                                    disabled={sending}
                                />
                                {sendError ? <p className="messageError">{sendError}</p> : null}
                                <div className="messageComposerActions">
                                    <button type="button" className="button" onClick={onSend} disabled={sending || !draft.trim()}>
                                        {sending ? "Sending..." : "Send message"}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}

export default function Messages() {
    const [conversation, setConversation] = useState<MessageConversationDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const sseBaseUrl = useMemo(() => {
        const base = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004").replace(/\/$/, "");
        return base;
    }, []);

    const loadConversation = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setConversation(await UserServices.getMyMessageConversation());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not load your messages");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadConversation();
    }, [loadConversation]);

    useEffect(() => {
        if (typeof EventSource === "undefined") {
            const interval = window.setInterval(() => void loadConversation(), 4000);
            return () => window.clearInterval(interval);
        }

        const source = new EventSource(`${sseBaseUrl}/api/messages/me/stream`, { withCredentials: true });

        source.onmessage = (evt: MessageEvent<string>) => {
            let data: MessageRealtimeEventDTO | null = null;
            try {
                data = JSON.parse(evt.data) as MessageRealtimeEventDTO;
            } catch {
                return;
            }

            const incoming = data?.message ?? null;
            if (!incoming?.messageId) return;

            setConversation((prev) => {
                if (!prev) return prev;
                const prevId = prev.conversationId ?? null;
                const nextId = data?.conversationId ?? null;
                if (prevId && nextId && prevId !== nextId) return prev;

                const messages = prev.messages ?? [];
                if (messages.some((m) => m.messageId === incoming.messageId)) {
                    // still update preview/unread metadata if needed
                    return {
                        ...prev,
                        lastMessageAt: data?.lastMessageAt ?? prev.lastMessageAt,
                        lastMessagePreview: data?.lastMessagePreview ?? prev.lastMessagePreview,
                        unreadByAdminCount: data?.unreadByAdminCount ?? prev.unreadByAdminCount,
                        unreadByUserCount: data?.unreadByUserCount ?? prev.unreadByUserCount,
                    };
                }

                const nextMessages: MessageEntryDTO[] = [...messages, incoming].slice().sort((a, b) => {
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

        source.addEventListener("error", () => {
            // EventSource will auto-reconnect; nothing to do here.
        });

        return () => {
            source.close();
        };
    }, [loadConversation, sseBaseUrl]);

    const sendMessage = async () => {
        const body = draft.trim();
        if (!body) return;
        try {
            setSending(true);
            setSendError(null);
            setConversation(await UserServices.sendMyMessage({ body }));
            setDraft("");
        } catch (err: unknown) {
            setSendError(err instanceof Error ? err.message : "Could not send your message");
        } finally {
            setSending(false);
        }
    };

    return (
        <UserMessagesView
            conversation={conversation}
            loading={loading}
            error={error}
            draft={draft}
            sending={sending}
            sendError={sendError}
            onDraftChange={setDraft}
            onSend={() => void sendMessage()}
        />
    );
}
