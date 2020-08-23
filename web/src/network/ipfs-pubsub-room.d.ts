declare module "ipfs-pubsub-room" {
  class PubSubRoom {
    constructor(ipfs: any, topic: string);

    getPeers(): string[];

    hasPeer(peer: string): boolean;

    async leave(): Promise<void>;

    async broadcast(message: ArrayBuffer | string): Promise<void>;

    sendTo(peer: string, message: ArrayBuffer | string): void;

    on(name: string, listener: (...args: any) => void);
  }
  export = PubSubRoom;
}
