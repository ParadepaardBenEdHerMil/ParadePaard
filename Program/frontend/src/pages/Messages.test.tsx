import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserMessagesView } from "./Messages";
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

const conversation: MessageConversationDTO = {
    conversationId: "conversation-1",
    userId: "user-1",
    userDisplayName: "Ava Jansen",
    userEmail: "ava@example.com",
    lastMessagePreview: "We will check this for you.",
    lastMessageAt: "2026-05-18T10:00:00Z",
    unreadByAdminCount: 0,
    unreadByUserCount: 1,
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

describe("Messages", () => {
    it("renders one company conversation with user and company messages", () => {
        const html = renderToStaticMarkup(
            <UserMessagesView
                conversation={conversation}
                loading={false}
                error={null}
                draft=""
                sending={false}
                sendError={null}
                onDraftChange={() => undefined}
                onSend={() => undefined}
            />
        );

        expect(html).toContain("Messages");
        expect(html).toContain("Company inbox");
        expect(html).toContain("Can someone help me with my planning?");
        expect(html).toContain("We will check this for you.");
        expect(html).toContain("You");
        expect(html).toContain("Company");
        expect(html).toContain("Send message");
    });

    it("shows an empty state before the first message", () => {
        const emptyConversation: MessageConversationDTO = {
            ...conversation,
            messages: [],
            lastMessagePreview: undefined,
            lastMessageAt: undefined,
        };

        const html = renderToStaticMarkup(
            <UserMessagesView
                conversation={emptyConversation}
                loading={false}
                error={null}
                draft=""
                sending={false}
                sendError={null}
                onDraftChange={() => undefined}
                onSend={() => undefined}
            />
        );

        expect(html).toContain("No messages yet");
        expect(html).toContain("Send your first message to the company.");
    });
});
