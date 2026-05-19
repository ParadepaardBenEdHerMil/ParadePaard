import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import { UserServices, type MessageConversationDTO, type MessageEntryDTO } from "../services/user-service/UserServices";
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
    onReload: () => void;
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
    onReload,
}: UserMessagesViewProps) {
    const messages = conversation?.messages ?? [];
    return (
        <>
            <Navbar />
            <div className="messagesPage">
                <div className="pageShell">
                    <PrimaryNav />
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
                                <button type="button" className="buttonSecondary" onClick={onReload} disabled={loading}>
                                    Refresh
                                </button>
                            </div>

                            {loading ? <p className="messageEmpty">Loading messages...</p> : null}
                            {error ? <p className="messageError">{error}</p> : null}
                            {!loading && !error ? (
                                <div className="messageList">
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
            onReload={() => void loadConversation()}
        />
    );
}
