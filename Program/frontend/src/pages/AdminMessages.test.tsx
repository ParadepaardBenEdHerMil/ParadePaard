import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMessagesView } from "./AdminMessages";
import type { MessageConversationDTO } from "../services/user-service/UserServices";

vi.mock("../components/Navbar", () => ({
    default: function MockNavbar() {
        return <header aria-label="Navbar" />;
    },
}));

vi.mock("../components/PrimaryNav", () => ({
    default: function MockPrimaryNav() {
        return <nav aria-label="Primary navigation" />;
    },
}));

const selectedConversation: MessageConversationDTO = {
    conversationId: "conversation-1",
    userId: "user-1",
    userDisplayName: "Ava Jansen",
    userEmail: "ava@example.com",
    lastMessagePreview: "Can someone help me with my planning?",
    lastMessageAt: "2026-05-18T09:55:00Z",
    unreadByAdminCount: 1,
    unreadByUserCount: 0,
    messages: [
        {
            messageId: "message-1",
            senderType: "USER",
            senderLabel: "You",
            body: "Can someone help me with my planning?",
            createdAt: "2026-05-18T09:55:00Z",
        },
        {
            messageId: "message-2",
            senderType: "ADMIN",
            senderLabel: "Company",
            body: "We will check this for you.",
            createdAt: "2026-05-18T10:00:00Z",
        },
    ],
};

const otherConversation: MessageConversationDTO = {
    conversationId: "conversation-2",
    userId: "user-2",
    userDisplayName: "Mila de Wit",
    userEmail: "mila@example.com",
    lastMessagePreview: "I uploaded the wrong file.",
    lastMessageAt: "2026-05-18T11:15:00Z",
    unreadByAdminCount: 0,
    unreadByUserCount: 0,
    messages: [],
};

const groupedConversation: MessageConversationDTO = {
    conversationId: "conversation-3",
    userId: "user-3",
    userDisplayName: "Noor Smit",
    userEmail: "noor@example.com",
    lastMessagePreview: "Older message text here",
    lastMessageAt: "2026-06-04T09:45:00Z",
    unreadByAdminCount: 0,
    unreadByUserCount: 0,
    messages: [
        {
            messageId: "message-yesterday",
            senderType: "USER",
            body: "Message text here",
            createdAt: "2026-06-14T12:32:00Z",
        },
        {
            messageId: "message-yesterday-2",
            senderType: "ADMIN",
            body: "Another message text here",
            createdAt: "2026-06-14T13:01:00Z",
        },
        {
            messageId: "message-wednesday",
            senderType: "USER",
            body: "Message text here",
            createdAt: "2026-06-10T07:18:00Z",
        },
        {
            messageId: "message-older",
            senderType: "ADMIN",
            body: "Older message text here",
            createdAt: "2026-06-04T09:45:00Z",
        },
    ],
};

describe("AdminMessages", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders the messenger names as the whole admin message box before a chat is selected", () => {
        const html = renderToStaticMarkup(
            <AdminMessagesView
                conversations={[selectedConversation, otherConversation]}
                selectedConversation={null}
                avatarUrls={{ "user-1": "blob:avatar-1" }}
                loading={false}
                detailLoading={false}
                error={null}
                detailError={null}
                draft=""
                sending={false}
                sendError={null}
                onSelectConversation={() => undefined}
                onDraftChange={() => undefined}
                onSend={() => undefined}
                onBackToInbox={() => undefined}
            />
        );

        expect(html).toContain("Shared Inbox");
        expect(html).toContain("Ava Jansen");
        expect(html).toContain("Mila de Wit");
        expect(html).toContain("1 unread");
        expect(html).not.toContain("Reply as company");
        expect(html).not.toContain("Select a conversation from the shared inbox.");
    });

    it("renders the selected user chat as the whole message box", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminMessagesView
                    conversations={[selectedConversation, otherConversation]}
                    selectedConversation={selectedConversation}
                    avatarUrls={{ "user-1": "blob:avatar-1" }}
                    loading={false}
                    detailLoading={false}
                    error={null}
                    detailError={null}
                    draft=""
                    sending={false}
                    sendError={null}
                    onSelectConversation={() => undefined}
                    onDraftChange={() => undefined}
                    onSend={() => undefined}
                    onBackToInbox={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Shared Inbox");
        expect(html).toContain("Ava Jansen");
        expect(html).toContain("Can someone help me with my planning?");
        expect(html).toContain("We will check this for you.");
        expect(html).toContain("Reply as company");
        expect(html).toContain("Send reply");
        expect(html).toContain(">Back</span>");
        expect(html).not.toContain("Back to inbox");
        expect(html).toContain('href="/management/users/user-1"');
        expect(html).toContain("messageThreadUserNameLink");
        expect(html).not.toContain("messageThreadUserLink");
        expect(html).toContain('src="blob:avatar-1"');
        expect(html).not.toContain("ava@example.com");
        expect(html).not.toContain("Mila de Wit");
    });

    it("renders inbox rows with a participant avatar beside the name", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminMessagesView
                    conversations={[selectedConversation, otherConversation]}
                    selectedConversation={null}
                    avatarUrls={{ "user-1": "blob:avatar-1" }}
                    loading={false}
                    detailLoading={false}
                    error={null}
                    detailError={null}
                    draft=""
                    sending={false}
                    sendError={null}
                    onSelectConversation={() => undefined}
                    onDraftChange={() => undefined}
                    onSend={() => undefined}
                    onBackToInbox={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("messageInboxAvatar");
        expect(html).toContain('src="blob:avatar-1"');
    });

    it("groups thread messages with date separators and time-only labels", () => {
        const weekdayLabel = new Date("2026-06-10T07:18:00Z").toLocaleDateString(undefined, { weekday: "long" });
        const olderDateLabel = new Date("2026-06-04T09:45:00Z").toLocaleDateString();
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminMessagesView
                    conversations={[groupedConversation]}
                    selectedConversation={groupedConversation}
                    avatarUrls={{}}
                    loading={false}
                    detailLoading={false}
                    error={null}
                    detailError={null}
                    draft=""
                    sending={false}
                    sendError={null}
                    onSelectConversation={() => undefined}
                    onDraftChange={() => undefined}
                    onSend={() => undefined}
                    onBackToInbox={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("messageDateSeparator");
        expect(html).toContain("Yesterday");
        expect(html).toContain(weekdayLabel);
        expect(html).toContain(olderDateLabel);
        expect(html).toContain("14:32");
        expect(html).toContain("15:01");
        expect(html).toContain("09:18");
        expect(html).toContain("11:45");
        expect(html).not.toContain(">User</span>");
        expect(html).not.toContain(">Company</span>");
        expect(html).not.toContain("14-06-2026");
    });

    it("shows an empty inbox state", () => {
        const html = renderToStaticMarkup(
            <AdminMessagesView
                conversations={[]}
                selectedConversation={null}
                avatarUrls={{}}
                loading={false}
                detailLoading={false}
                error={null}
                detailError={null}
                draft=""
                sending={false}
                sendError={null}
                onSelectConversation={() => undefined}
                onDraftChange={() => undefined}
                onSend={() => undefined}
                onBackToInbox={() => undefined}
            />
        );

        expect(html).toContain("No conversations yet");
    });
});
