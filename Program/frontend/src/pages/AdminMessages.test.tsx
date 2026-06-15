import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

describe("AdminMessages", () => {
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
        expect(html).toContain("ava@example.com");
        expect(html).toContain("Can someone help me with my planning?");
        expect(html).toContain("We will check this for you.");
        expect(html).toContain("Reply as company");
        expect(html).toContain("Send reply");
        expect(html).toContain(">Back</span>");
        expect(html).not.toContain("Back to inbox");
        expect(html).toContain('href="/management/users/user-1"');
        expect(html).toContain('src="blob:avatar-1"');
        expect(html).toContain("messageThreadUserLink");
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
