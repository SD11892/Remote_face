import { useCallback, useState, useRef, useEffect } from "react";
import { useSnapshot } from "valtio";

import { getRoomState } from "../states/roomMap";
import { roomPresets } from "../states/roomPresets";
import { getRoomPresetFromUrl } from "../utils/url";

const getInitialPosition = (uid: string): [number, number] => [
  parseInt(uid.slice(0, 2), 16) / 2 + 10,
  parseInt(uid.slice(2, 4), 16) / 2 + 10,
];

export type AvatarData = {
  position: [left: number, top: number];
};

const isAvatarData = (x: unknown): x is AvatarData => {
  try {
    const obj = x as AvatarData;
    if (
      typeof obj.position[0] === "number" &&
      typeof obj.position[1] === "number"
    ) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export type RegionData = {
  type:
    | "default"
    | "meeting"
    | "chat"
    | "media"
    | "screen"
    | "goboard"
    | "talky";
  position: [left: number, top: number];
  size: [width: number, height: number];
  zIndex?: number;
  background?: string;
  border?: string;
  iframe?: string;
  movable?: boolean;
  meetingRegionId?: string;
};

export const isRegionData = (x: unknown): x is RegionData => {
  try {
    const obj = x as RegionData;
    if (
      [
        "default",
        "meeting",
        "chat",
        "media",
        "screen",
        "goboard",
        "talky",
      ].includes(obj.type) &&
      typeof obj.position[0] === "number" &&
      typeof obj.position[1] === "number" &&
      typeof obj.size[0] === "number" &&
      typeof obj.size[1] === "number" &&
      (typeof obj.zIndex === "undefined" || typeof obj.zIndex === "number") &&
      (typeof obj.background === "undefined" ||
        typeof obj.background === "string") &&
      (typeof obj.border === "undefined" || typeof obj.border === "string") &&
      (typeof obj.iframe === "undefined" || typeof obj.iframe === "string") &&
      (typeof obj.movable === "undefined" ||
        typeof obj.movable === "boolean") &&
      (typeof obj.meetingRegionId === "undefined" ||
        typeof obj.meetingRegionId === "string")
    ) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export type AvatarMap = {
  [userId: string]: AvatarData;
};

export type RegionMap = {
  [regionId: string]: RegionData;
};

export const useGatherArea = (roomId: string, userId: string) => {
  const roomState = getRoomState(roomId, userId);
  const { userIdList, gatherAvatarMap, gatherRegionMap } =
    useSnapshot(roomState);

  const avatarMap: AvatarMap = {};
  userIdList.forEach(({ userId }) => {
    const data = gatherAvatarMap[userId];
    if (!isAvatarData(data)) return;
    avatarMap[userId] = data;
  });

  const [myAvatar, setMyAvatar] = useState<AvatarData>({
    position: getInitialPosition(userId),
  });
  const dataToBroadcast = useRef<AvatarData>();

  useEffect(() => {
    if (!myAvatar) return;
    if (dataToBroadcast.current) {
      dataToBroadcast.current = myAvatar;
    } else {
      dataToBroadcast.current = myAvatar;
      setTimeout(() => {
        roomState.gatherAvatarMap[userId] = dataToBroadcast.current;
        dataToBroadcast.current = undefined;
      }, 500);
    }
  }, [roomState, userId, myAvatar]);

  const regionMap: RegionMap = {};
  Object.entries(gatherRegionMap).forEach(([id, data]) => {
    if (isRegionData(data)) {
      regionMap[id] = data;
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const roomPreset = getRoomPresetFromUrl() || "";
      const preset = roomPresets[roomPreset];
      if (!preset) return;
      if (Object.keys(roomState.gatherRegionMap).length > 0) return;
      Object.entries(preset).forEach(([id, data]) => {
        roomState.gatherRegionMap[id] = data;
      });
    }, 10 * 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [roomState]);

  type Timeout = ReturnType<typeof setTimeout>;

  const timerMap = useRef<{ [id: string]: Timeout }>({});
  const updateRegion = useCallback(
    (id: string, data: RegionData | null) => {
      clearTimeout(timerMap.current[id]);
      timerMap.current[id] = setTimeout(() => {
        if (data === null) {
          delete roomState.gatherRegionMap[id];
          return;
        }
        const found = roomState.gatherRegionMap[id];
        if (found && isRegionData(found)) {
          Object.keys(data).forEach((key) => {
            (found as any)[key as keyof RegionData] =
              data[key as keyof RegionData];
          });
        } else {
          roomState.gatherRegionMap[id] = data;
        }
      }, 500);
    },
    [roomState]
  );

  return {
    avatarMap,
    myAvatar,
    setMyAvatar,
    regionMap,
    updateRegion,
  };
};
