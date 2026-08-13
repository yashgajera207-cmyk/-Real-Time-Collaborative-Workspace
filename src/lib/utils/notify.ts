import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export async function notifyMentions(params: {
  documentId: string;
  threadId: string;
  actorId: string;
  actorName: string;
  mentionedUserIds: string[];
}): Promise<void> {
  const recipients = params.mentionedUserIds.filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: params.actorId,
      type: NotificationType.mention,
      documentId: params.documentId,
      threadId: params.threadId,
      message: `${params.actorName} mentioned you in a comment`,
    })),
  });
}

export async function notifyReply(params: {
  documentId: string;
  threadId: string;
  actorId: string;
  actorName: string;
  threadOwnerId: string;
}): Promise<void> {
  if (params.threadOwnerId === params.actorId) return;

  await prisma.notification.create({
    data: {
      userId: params.threadOwnerId,
      actorId: params.actorId,
      type: "comment_reply",
      documentId: params.documentId,
      threadId: params.threadId,
      message: `${params.actorName} replied to your comment`,
    },
  });
}
