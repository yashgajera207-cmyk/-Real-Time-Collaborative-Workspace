import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

function truncateText(text: string, maxLen = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + "...";
}

export async function notifyMentions(params: {
  documentId: string;
  threadId: string;
  actorId: string;
  actorName: string;
  mentionedUserIds: string[];
  commentBody?: string;
}): Promise<void> {
  const recipients = params.mentionedUserIds.filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;

  const preview = params.commentBody ? ` "${truncateText(params.commentBody)}"` : "";

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: params.actorId,
      type: NotificationType.mention,
      documentId: params.documentId,
      threadId: params.threadId,
      message: `${params.actorName} mentioned you in a comment:${preview}`,
    })),
  });
}

export async function notifyReply(params: {
  documentId: string;
  threadId: string;
  actorId: string;
  actorName: string;
  threadOwnerId: string;
  commentBody?: string;
}): Promise<void> {
  if (params.threadOwnerId === params.actorId) return;

  const preview = params.commentBody ? ` "${truncateText(params.commentBody)}"` : "";

  await prisma.notification.create({
    data: {
      userId: params.threadOwnerId,
      actorId: params.actorId,
      type: "comment_reply",
      documentId: params.documentId,
      threadId: params.threadId,
      message: `${params.actorName} replied to your comment:${preview}`,
    },
  });
}
