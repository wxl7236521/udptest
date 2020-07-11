declare class udpTest {
    numPacket: any;
    sendCount: any;
    perCount: any;
    interval: any;
    ipServer: string;
    portServer: any;
    isClinet: boolean;
    portClinet: any;
    ipv4oripv6: any;
    currentReceive: Map<String, any>;
    lostReceive: Map<String, any>;
    client: any;
    sockStreamReader: any;
    constructor(numPacket: any, sendCount: any, perCount: any, interval: any, ipServer: any, portServer: any, isClinet: any, portClinet: any, ipv4oripv6: any);
    sendData(id: any): void;
    init(): void;
    send(o: any, port: any, ip: any): void;
    registerProtocolBody(): void;
}
export default udpTest;
