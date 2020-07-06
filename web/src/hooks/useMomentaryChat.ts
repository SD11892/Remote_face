import { useState, useCallback, useRef, useEffect } from "react";

import { secureRandomId } from "../utils/crypto";
import { isObject } from "../utils/types";
import { useRoomData, useBroadcastData, useRoomNewPeer } from "./useRoom";

const MAX_CHAT_LIST_SIZE = 100;

type ChatData = {
  userId: string;
  nickname: string;
  messageId: string;
  createdAt: number; // in millisecond
  chatText: string;
  chatInReplyTo?: string; // messageId
};

const isChatData = (x: unknown): x is ChatData =>
  isObject(x) &&
  typeof (x as { userId: unknown }).userId === "string" &&
  typeof (x as { nickname: unknown }).nickname === "string" &&
  typeof (x as { messageId: unknown }).messageId === "string" &&
  typeof (x as { createdAt: unknown }).createdAt === "number" &&
  typeof (x as { chatText: unknown }).chatText === "string" &&
  (typeof (x as { chatInReplyTo: unknown }).chatInReplyTo === "undefined" ||
    typeof (x as { chatInReplyTo: unknown }).chatInReplyTo === "string");

type Reply = [string, number];

const isReply = (x: unknown): x is Reply =>
  Array.isArray(x) &&
  x.length === 2 &&
  typeof x[0] === "string" &&
  typeof x[1] === "number";

const isReplies = (x: unknown): x is Reply[] =>
  Array.isArray(x) && x.every(isReply);

export type ChatItem = {
  messageId: string;
  nickname: string;
  createdAt: number; // in millisecond
  text: string;
  replies: Reply[];
  time: string;
};

const isChatItem = (x: unknown): x is ChatItem =>
  isObject(x) &&
  typeof (x as { messageId: unknown }).messageId === "string" &&
  typeof (x as { nickname: unknown }).nickname === "string" &&
  typeof (x as { createdAt: unknown }).createdAt === "number" &&
  typeof (x as { text: unknown }).text === "string" &&
  isReplies((x as { replies: unknown }).replies) &&
  typeof (x as { time: unknown }).time === "string";

type ChatList = ChatItem[];

const isChatList = (x: unknown): x is ChatList =>
  Array.isArray(x) && x.every(isChatItem);

const compareReply = (a: Reply, b: Reply) => {
  const countDiff = b[1] - a[1];
  if (countDiff === 0) {
    return a[0].length - b[0].length;
  }
  return countDiff;
};

export const useMomentaryChat = (
  roomId: string,
  userId: string,
  nickname: string
) => {
  const [chatList, setChatList] = useState<ChatList>([]);
  const chatListRef = useRef(chatList);
  useEffect(() => {
    chatListRef.current = chatList;
  });

  const addChatItem = useCallback((chatData: ChatData) => {
    if (chatData.chatInReplyTo) {
      const { chatText, chatInReplyTo } = chatData;
      setChatList((prev) =>
        prev.map((item) => {
          if (item.messageId === chatInReplyTo) {
            const replyMap = new Map(item.replies);
            replyMap.set(chatText, (replyMap.get(chatText) || 0) + 1);
            const replies = [...replyMap.entries()];
            replies.sort(compareReply);
            return { ...item, replies };
          }
          return item;
        })
      );
      return;
    }
    const chatItem: ChatItem = {
      messageId: chatData.messageId,
      nickname: chatData.nickname,
      createdAt: chatData.createdAt,
      text: chatData.chatText,
      replies: [],
      time: new Date(chatData.createdAt)
        .toLocaleString()
        .split(" ")[1]
        .slice(0, -3),
    };
    setChatList((prev) => {
      if (prev.some((item) => item.messageId === chatItem.messageId)) {
        // Migration: This can happen if a peer with old version is connected.
        return prev;
      }
      const newList = [chatItem, ...prev];
      if (newList.length > MAX_CHAT_LIST_SIZE) {
        newList.pop();
      }
      newList.sort((a, b) => b.createdAt - a.createdAt); // slow?
      return newList;
    });
  }, []);

  useRoomNewPeer(
    roomId,
    userId,
    useCallback(async () => {
      // TODO do not let all peers send initial data
      return chatListRef.current;
    }, [])
  );

  const broadcastData = useBroadcastData(roomId, userId);
  useRoomData(
    roomId,
    userId,
    useCallback(
      (data) => {
        if (isChatData(data)) {
          addChatItem(data);
        } else if (isChatList(data)) {
          setChatList((prev) => {
            if (prev.length === 0) {
              // we only replace with the list if it's empty
              return data;
            }
            return prev;
          });
        }
      },
      [addChatItem]
    )
  );

  const sendChat = useCallback(
    (text: string) => {
      const data: ChatData = {
        userId,
        nickname,
        messageId: secureRandomId(),
        createdAt: Date.now(),
        chatText: text,
      };
      broadcastData(data);
      addChatItem(data);
    },
    [broadcastData, userId, nickname, addChatItem]
  );

  const replyChat = useCallback(
    (text: string, inReplyTo: string) => {
      const data: ChatData = {
        userId,
        nickname,
        messageId: secureRandomId(),
        createdAt: Date.now(),
        chatText: text,
        chatInReplyTo: inReplyTo,
      };
      broadcastData(data);
      addChatItem(data);
    },
    [broadcastData, userId, nickname, addChatItem]
  );

  return {
    chatList,
    sendChat,
    replyChat,
  };
};
