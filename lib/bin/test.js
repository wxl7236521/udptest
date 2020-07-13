#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const udpTest_1 = require("./udpTest");
commander_1.program
    .option('-s, --server', 'start Server')
    .option('-c, --client', 'start Client')
    .option('-p, --port <type>', 'set port')
    .option('-ip, --ip <type>', 'set ip')
    .option('-id, --id <type>', 'set send id')
    .option('-np, --numPacket <type>', 'set numPacket', '1')
    .option('-sc, --sendCount <type>', 'set sendCount', '100')
    .option('-pc, --perCount <type>', 'set perCount', '1')
    .option('-itl, --interval <type>', 'set interval', '100')
    .option('-st, --socketType <type>', 'set SocketType ipv4=udp4;ipv6=udp6', 'udp4');
commander_1.program.parse(process.argv);
//console.log(program.opts())
if (commander_1.program.server && commander_1.program.port && commander_1.program.socketType) {
    new udpTest_1.udpTest(null, null, null, null, null, commander_1.program.port, false, null, commander_1.program.socketType);
    console.log('udp服务端已成功运行，端口号' + commander_1.program.port);
}
if (commander_1.program.client && commander_1.program.port && commander_1.program.numPacket && commander_1.program.sendCount && commander_1.program.perCount && commander_1.program.interval
    && commander_1.program.ip && commander_1.program.socketType && commander_1.program.id) {
    new udpTest_1.udpTest(commander_1.program.numPacket, commander_1.program.sendCount, commander_1.program.perCount, commander_1.program.interval, commander_1.program.ip, commander_1.program.port, true, null, commander_1.program.socketType).sendData(commander_1.program.id);
}
if (!commander_1.program.client && !commander_1.program.server) {
    commander_1.program.outputHelp();
}
